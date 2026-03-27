from fastapi import APIRouter, HTTPException, Request
from service.attraction import get_attraction_with_cache
import os
from db import db

router = APIRouter()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def _with_city(a) -> dict:
    """Flatten a CacheAttraction (with city included) into a plain dict."""
    d = a.__dict__.copy() if hasattr(a, '__dict__') else dict(a)
    d['city_name'] = a.city.name if getattr(a, 'city', None) else None
    d.pop('city', None)
    return d

# Mapping: preference value → place_types to include
PREFERENCE_TYPE_MAP: dict[str, list[str]] = {
    # travel_style
    "relax":     ["spa", "lodging", "park"],
    "culture":   ["museum", "art_gallery", "tourist_attraction"],
    "food":      ["restaurant", "food", "bar", "cafe"],
    "adventure": ["amusement_park", "stadium", "gym"],
    "city":      ["tourist_attraction", "shopping_mall", "night_club"],
    "nature":    ["park", "natural_feature", "campground"],
    # interests
    "temples":     ["place_of_worship", "tourist_attraction"],
    "street_food": ["restaurant", "food", "bakery"],
    "shopping":    ["shopping_mall", "store", "clothing_store"],
    "night":       ["night_club", "bar", "casino"],
    "onsen":       ["spa", "natural_feature"],
    "anime":       ["museum", "book_store", "tourist_attraction"],
    "photo":       ["tourist_attraction", "park", "natural_feature"],
    "sakura":      ["park", "tourist_attraction"],
}

@router.get("/attractions/{id}")
async def get_attraction(id: int):

    attraction = await get_attraction_with_cache(id)
    if not attraction:
        raise HTTPException(status_code=404, detail="Not found")
    
    # แปลง photo_ref เป็น URL รูปภาพพร้อมใช้
    img_url = None
    if attraction.photo_ref:
        img_url = f"https://places.googleapis.com/v1/{attraction.photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key={GOOGLE_API_KEY}"

    return {
        "id": attraction.attraction_id,
        "name": attraction.name,
        "rating": attraction.rating,
        "image": img_url,
        "address": attraction.address
    }


@router.get("/attractions/")
async def get_all_attractions(request: Request, personalized: bool = False):
    if personalized:
        email = getattr(request.state, "email", None)
        print(f"[PREF] personalized=True | email={email}")
        if email:
            user = await db.customer.find_unique(where={"email": email})
            if user:
                pref = await db.userpreference.find_unique(where={"customer_id": user.customer_id})
                if pref:
                    print(f"[PREF] travel_style={pref.travel_style} | interests={pref.interests} | trip_length={pref.trip_length}")
                    matched_types: set[str] = set()
                    for key in [pref.travel_style] + list(pref.interests):
                        matched_types.update(PREFERENCE_TYPE_MAP.get(key, []))
                    print(f"[PREF] matched place_types={sorted(matched_types)}")
                    if matched_types:
                        attractions = await db.cacheattraction.find_many(
                            where={"place_types": {"has_some": list(matched_types)}},
                            order={"rating": "desc"},
                            include={"city": True},
                        )
                        print(f"[PREF] filtered results={len(attractions)} attractions")
                        return [_with_city(a) for a in attractions]
                else:
                    print(f"[PREF] no preference found for customer_id={user.customer_id} → fallback to all")
            else:
                print(f"[PREF] user not found for email={email} → fallback to all")
        else:
            print(f"[PREF] no email in request.state (token missing?) → fallback to all")

    # Default: return all ordered by rating
    attractions = await db.cacheattraction.find_many(
        order={"rating": "desc"},
        include={"city": True},
    )
    print(f"[PREF] fallback: returning all {len(attractions)} attractions")
    return [_with_city(a) for a in attractions]

@router.get("/explore-cities")
async def get_explore_data():
    cities = await db.city.find_many(
        include={
            "attractions": {
                "take": 5,                
                "order_by": {"rating": "desc"} 
            }
        }
    )
    return cities