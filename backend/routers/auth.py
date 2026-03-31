from fastapi import APIRouter, Depends, HTTPException, Request
from prisma import Prisma
import bcrypt
from jose import jwt, JWTError
from datetime import datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from schemas import GoogleLoginRequest
import secrets

from dependencies import get_db, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM
from schemas import Customer, CustomerLogin, CustomerOut, TokenRefreshRequest, GoogleLoginRequest, UserPreferenceCreate, UserPreferenceResponse
import os

router = APIRouter(tags=["Auth"])

GOOGLE_CLIENT_ID = "1027287817106-us5ausutbq2hqp4sofsdvc0d3gjacfra.apps.googleusercontent.com"

@router.post("/refresh-token", response_model=CustomerOut)
async def refresh_token(data: TokenRefreshRequest, db: Prisma = Depends(get_db)):
    try:
        payload = jwt.decode(data.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db_user = await db.customer.find_unique(where={"email": email})
    if not db_user or db_user.refreshToken != data.refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token mismatch")

    new_access = create_access_token(email)
    new_refresh = create_refresh_token(email)

    await db.customer.update(
        where={"email": email},
        data={"currentToken": new_access, "refreshToken": new_refresh}
    )
    return {"email": email, "token": new_access, "refresh_token": new_refresh}

@router.post("/register", response_model=CustomerOut)
async def register(customer: Customer, db: Prisma = Depends(get_db)):
    try:
        existing = await db.customer.find_unique(where={"email": customer.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        if not customer.first_name or not customer.last_name:
            raise HTTPException(status_code=422, detail="First name and last name are required")
        if not customer.password or len(customer.password) < 6:
            raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

        hashed = bcrypt.hashpw(customer.password.encode(), bcrypt.gensalt()).decode()
        access_token = create_access_token(customer.email)
        refresh_token = create_refresh_token(customer.email)

        birth_date = None
        if customer.birth_date:
            try:
                if isinstance(customer.birth_date, str):
                    birth_date = datetime.fromisoformat(customer.birth_date)
                elif isinstance(customer.birth_date, datetime):
                    birth_date = customer.birth_date
            except ValueError:
                raise HTTPException(status_code=422, detail="Invalid date format")

        await db.customer.create(
            data={
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "email": customer.email,
                "password": hashed,
                "currentToken": None,
                "refreshToken": refresh_token,
                "phone_number": customer.phone_number,
                "birth_date": birth_date,
            }
        )
        return {"email": customer.email, "token": access_token, "refresh_token": refresh_token}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/login", response_model=CustomerOut)
async def login(customer: CustomerLogin, db: Prisma = Depends(get_db)):
    db_customer = await db.customer.find_unique(where={"email": customer.email})
    if not db_customer or not bcrypt.checkpw(customer.password.encode(), db_customer.password.encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if db_customer.currentToken:
        raise HTTPException(status_code=403, detail="User already logged in elsewhere")

    access_token = create_access_token(customer.email)
    refresh_token = create_refresh_token(customer.email)

    await db.customer.update(
        where={"email": customer.email},
        data={"currentToken": access_token, "refreshToken": refresh_token}
    )
    return {"email": customer.email, "token": access_token, "refresh_token": refresh_token}

@router.post("/google-login", response_model=CustomerOut)
async def google_login(data: GoogleLoginRequest, db: Prisma = Depends(get_db)):
    try:
        # 1. ตรวจสอบ Token กับ Google
        id_info = id_token.verify_oauth2_token(
            data.token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )

        # 2. ดึงข้อมูล User จาก Token
        email = id_info.get("email")
        first_name = id_info.get("given_name", "")
        last_name = id_info.get("family_name", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google Token: Email not found")

        # 3. เช็คว่ามี User ในระบบหรือยัง
        user = await db.customer.find_unique(where={"email": email})

        if not user:
            # 4. ถ้ายังไม่มี -> สมัครสมาชิกให้อัตโนมัติ (Register)
            # สร้างรหัสผ่านสุ่ม เพราะ login ผ่าน google ไม่ได้ใช้ password แต่ Database บังคับใส่
            random_password = secrets.token_urlsafe(16) 
            hashed_password = bcrypt.hashpw(random_password.encode(), bcrypt.gensalt()).decode()
            
            # สร้าง Token ของระบบเรา
            access_token = create_access_token(email)
            refresh_token = create_refresh_token(email)

            user = await db.customer.create(
                data={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "password": hashed_password, # รหัสผ่านสุ่ม
                    "currentToken": access_token,
                    "refreshToken": refresh_token,
                    # phone_number และ birth_date อาจจะเป็น null ไปก่อน
                }
            )
        else:
            # 5. ถ้ามีแล้ว -> Login เลย (Update Token)
            # เช็คว่า User นี้ Login ซ้อนเครื่องอื่นอยู่ไหม (Optional: ตาม Logic เดิมของคุณ)
            if user.currentToken:
                 # กรณีนี้อาจจะยอมให้ Login ทับไปเลย หรือจะ Block ก็ได้
                 # แต่ปกติ Social Login มักจะยอมให้เข้าได้เลยเพื่อความสะดวก
                 pass 

            access_token = create_access_token(email)
            refresh_token = create_refresh_token(email)

            await db.customer.update(
                where={"email": email},
                data={
                    "currentToken": access_token,
                    "refreshToken": refresh_token
                }
            )

        return {
            "email": user.email,
            "token": access_token,
            "refresh_token": refresh_token
        }

    except ValueError as e:
        # Token ไม่ถูกต้อง
        raise HTTPException(status_code=401, detail="Invalid Google Token")
    except Exception as e:
        print(f"Google Login Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/change-password")
async def change_password(data: dict, request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    current_password = data.get("current_password", "")
    new_password     = data.get("new_password", "")

    if not current_password or not new_password:
        raise HTTPException(status_code=422, detail="Both current and new password are required")
    if len(new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")

    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not bcrypt.checkpw(current_password.encode(), user.password.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    await db.customer.update(where={"email": email}, data={"password": hashed})
    return {"detail": "Password changed successfully"}


@router.post("/user/preferences", response_model=UserPreferenceResponse)
async def upsert_preferences(data: UserPreferenceCreate, request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.userpreference.find_unique(where={"customer_id": user.customer_id})
    if existing:
        pref = await db.userpreference.update(
            where={"customer_id": user.customer_id},
            data={"travel_style": data.travel_style, "interests": data.interests, "trip_length": data.trip_length}
        )
    else:
        pref = await db.userpreference.create(
            data={"customer_id": user.customer_id, "travel_style": data.travel_style, "interests": data.interests, "trip_length": data.trip_length}
        )
    return {"travel_style": pref.travel_style, "interests": pref.interests, "trip_length": pref.trip_length}


@router.get("/user/preferences", response_model=UserPreferenceResponse)
async def get_preferences(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    pref = await db.userpreference.find_unique(where={"customer_id": user.customer_id})
    if not pref:
        raise HTTPException(status_code=404, detail="No preferences set")
    return {"travel_style": pref.travel_style, "interests": pref.interests, "trip_length": pref.trip_length}


@router.post("/logout")
async def logout(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    await db.customer.update(
        where={"email": email},
        data={"currentToken": None, "refreshToken": None}
    )
    return {"detail": "Logged out successfully"}

@router.get("/user")
async def get_user(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "customer_id": user.customer_id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone_number": user.phone_number,
        "birth_date": user.birth_date.isoformat() if user.birth_date else None,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "image": user.image
    }

