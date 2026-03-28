from fastapi import APIRouter, Depends, HTTPException
from prisma import Prisma, types
from prisma.errors import ForeignKeyViolationError, UniqueViolationError, RecordNotFoundError
from datetime import datetime, timedelta, date as D, time as T
import json
from typing import Any
from dependencies import get_db, get_current_user
from schemas import TripPlan, TripSchedule, TripScheduleDocIn, TripScheduleBulkRequest, TripPlanUpdate, TripPlanDuplicateIn

router = APIRouter(tags=["Plan & Schedule"])

# --- Trip Plan ---
@router.get("/trip_plan")
async def read_trip_plan(db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        print("current_user_id:", current_user.customer_id)

        trip_plan = await db.tripplan.find_many(
            where={
                "OR" : [
                    {"creator_id": current_user.customer_id},
                    {
                        "tripGroup": {
                            "members": {
                                "some": {
                                    "customer_id": current_user.customer_id
                                }
                            }
                        }
                    }
                    ]},
            include={
                "schedules": True,
                "tripGroup": {
                    "include": {
                        "members": True # ✅ สั่งให้ดึงสมาชิกมาด้วย
                    }
                },
            }
        )
        return trip_plan
    
    except Exception as e:
        return {"error": str(e)}

@router.get("/trip_plan/ended")
async def get_ended_trips(db: Prisma = Depends(get_db)):
    """Return all trips that have already ended (public — no auth required)."""
    today = D.today()
    trips = await db.tripplan.find_many(
        where={"end_plan_date": {"lt": datetime(today.year, today.month, today.day)}},
        order={"end_plan_date": "desc"},
    )
    return trips

@router.get("/trip_plan/{plan_id}")
async def read_trip_plan_by_id(plan_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_plan = await db.tripplan.find_unique(
            where={"plan_id": plan_id},
            include={
                "schedules": True,
                "budget": True,
                "tripGroup": {
                    "include": {
                        "members": True # ✅ สั่งให้ดึงสมาชิกมาด้วย
                    }
                },
            }
        )
        return trip_plan
    
    except Exception as e:
        return {"error": str(e)}

@router.post("/trip_plan")
async def create_trip_plan(trip_plan: TripPlan, db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:

        trip_plan = trip_plan.model_dump()
        trip_plan["creator_id"] = current_user.customer_id
        trip_plan["day_of_trip"] = (trip_plan["end_plan_date"] - trip_plan["start_plan_date"]).days + 1
        print("Creating trip plan with data:", trip_plan)
        
        trip_plans = await db.tripplan.create(
            data={
                **trip_plan,
                "budget": {
                    "create": {
                        "total_budget": 0
                    }
                }
            },
            include={
                "schedules": True,
                "budget": True
            }
        )
        
        return trip_plans

    except Exception as e:
        print("🔥 Validation Error:", e)
        return {"error": str(e)}

@router.delete("/trip_plan/{plan_id}")
async def delete_trip_plan(plan_id: int, db: Prisma = Depends(get_db)):
    return await db.tripplan.delete(where={"plan_id": plan_id})


@router.put("/trip_plan/{plan_id}")
async def update_trip_plan(plan_id: int, trip_plan: TripPlanUpdate, db: Prisma = Depends(get_db)):
    try:
        # ดึงเฉพาะค่าที่ส่งมา (exclude_unset=True) เพื่อไม่ให้ค่าอื่นโดนทับด้วย null
        data = trip_plan.model_dump(exclude_unset=True)
        print(trip_plan)
        print(f"📦 Data going to DB: {data}")
        updated_plan = await db.tripplan.update(
            where={"plan_id": plan_id},
            data=data
        )
        return updated_plan
    
    except Exception as e:
        print(f"Error updating trip plan: {e}")
        # แนะนำให้ return status code ที่ถูกต้อง
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trip_plan/{plan_id}/duplicate")
async def duplicate_trip_plan(
    plan_id: int,
    body: TripPlanDuplicateIn,
    db: Prisma = Depends(get_db),
    current_user = Depends(get_current_user),
):
    source = await db.tripplan.find_unique(where={"plan_id": plan_id})
    if not source:
        raise HTTPException(status_code=404, detail="Source trip plan not found")

    duration_days = (source.end_plan_date.date() - source.start_plan_date.date()).days
    new_start = body.start_plan_date.replace(hour=0, minute=0, second=0, microsecond=0)
    new_end = new_start + timedelta(days=duration_days)
    resolved_image = body.image if body.image is not None else source.image

    new_plan = await db.tripplan.create(
        data={
            "name_group": body.name_group,
            "start_plan_date": new_start,
            "end_plan_date": new_end,
            "day_of_trip": duration_days + 1,
            "image": resolved_image,
            "city": source.city,
            "creator_id": current_user.customer_id,
            "budget": {"create": {"total_budget": 0}},
        },
        include={"budget": True},
    )

    source_schedule = await db.tripschedule.find_first(where={"plan_id": plan_id})
    if source_schedule:
        payload = source_schedule.payload
        if not isinstance(payload, str):
            payload = json.dumps(payload, ensure_ascii=False)
        await db.tripschedule.create(
            data={"plan_id": new_plan.plan_id, "payload": payload}
        )

    return {
        "plan_id": new_plan.plan_id,
        "name_group": new_plan.name_group,
        "start_plan_date": new_plan.start_plan_date,
        "end_plan_date": new_plan.end_plan_date,
        "image": new_plan.image,
        "city": new_plan.city,
        "day_of_trip": new_plan.day_of_trip,
    }


# --- Trip Schedule ---
EPOCH_DATE = D(1970, 1, 1)

def normalize_for_prisma(item: TripSchedule) -> dict:
    sec = item.time.second if isinstance(item.time.second, int) else 0
    tt = T(item.time.hour, item.time.minute, sec)
    return {
        "plan_id": item.plan_id,
        "date": datetime.combine(item.date, T(0, 0, 0)),
        "time": datetime.combine(EPOCH_DATE, tt),
        "activity": item.activity,
        "description": item.description or "",
    }   

@router.get("/trip_schedule/{plan_id}")
async def read_by_plan(plan_id: int, db: Prisma = Depends(get_db)):
    schedule = await db.tripschedule.find_first(
        where={"plan_id": plan_id}
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Plan not found")
    return schedule

@router.post("/trip_schedule")
async def create_trip_schedule_doc(trip_schedule: TripScheduleDocIn, db: Prisma = Depends(get_db)):
    try:
        trip_schedule = trip_schedule.model_dump()
        payload_json = json.dumps(trip_schedule["payload"])
        doc = await db.tripschedule.create(
            data={
                "payload": payload_json,       # required
                "plan_id" : trip_schedule["plan_id"],  # required
            }
        )
        return doc
    except UniqueViolationError:
        # มี plan_id นี้อยู่แล้ว
        raise HTTPException(status_code=409, detail="plan_id already exists; use PUT /trip_schedule/{plan_id}")
    except ForeignKeyViolationError:
        raise HTTPException(status_code=404, detail="TripPlan not found for given plan_id")

@router.put("/trip_schedule/{plan_id}")
async def replace_trip_schedule_doc(plan_id: int, trip_schedule: TripScheduleDocIn, db: Prisma = Depends(get_db)):
    trip_schedule = trip_schedule.model_dump()
    payload = trip_schedule["payload"]   # ✅ ตรงนี้เป็น dict/list อยู่แล้ว
    if not isinstance(payload, str):
        payload = json.dumps(payload, ensure_ascii=False)
    
    try:
        return await db.tripschedule.update(
            where={"plan_id": trip_schedule["plan_id"]},
            data={"payload": payload}  # Now it's a proper JSON string
        )
    except RecordNotFoundError:
        try:
            return await db.tripschedule.create(
                data={"plan_id": plan_id, "payload": payload}
            )
        except ForeignKeyViolationError:
            raise HTTPException(status_code=404, detail="TripPlan not found for given plan_id")
        