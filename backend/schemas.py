from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time

class Customer(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    birth_date: Optional[datetime] = None
    image : Optional[str] = None
    
class CustomerLogin(BaseModel):
    email: str
    password: str

class CustomerOut(BaseModel):
    email: str
    token: str
    refresh_token: str 

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class TripGroup(BaseModel):
    name_group: str
    description: Optional[str] = ""
    start_date: datetime
    end_date: datetime
    
class GroupMember(BaseModel):
    customer_id: int
    trip_id: int

class Budget(BaseModel):
    trip_id: Optional[int] = None
    plan_id: Optional[int] = None
    total_budget: float

class BudgetUpdate(BaseModel):
    total_budget: int

class Expense(BaseModel):
    budget_id: int
    category: str
    amount: float
    description: Optional[str] = ""

class TripPlan(BaseModel):
    name_group: str
    start_plan_date: datetime
    end_plan_date: datetime
    day_of_trip: Optional[int] = None
    trip_id: Optional[int] = None
    image: Optional[str] = None
    city: Optional[str] = None

class TripPlanUpdate(BaseModel):
    name_group: Optional[str] = None
    end_plan_date: Optional[datetime] = None
    day_of_trip: Optional[int] = None
    image: Optional[str] = None
    city: Optional[str] = None
    
class TripSchedule(BaseModel):
    plan_id: int
    date: date  
    time: time
    activity: str = Field(..., max_length=300)
    description: str = Field("", max_length=300)

class TripScheduleDocIn(BaseModel):  
    plan_id: int
    payload: Dict[str, Any]

class TripScheduleBulkRequest(BaseModel):
    items: List[TripSchedule]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatBody(BaseModel):
    start_date: str
    end_date: str
    messages: List[ChatMessage]
    itinerary_data: Optional[dict] = None

class City(BaseModel):
    id: int
    name: str

class JoinGroupRequest(BaseModel):
    unique_code: str

class GoogleLoginRequest(BaseModel):
    token: str

class Location(BaseModel):
    itinerary_data: Dict[str, Any]

class RouteSummarizeRequest(BaseModel):
    route: Dict[str, Any]

class RouteRequest(BaseModel):
    start: str
    goal: str
    start_time: str

class UserPreferenceCreate(BaseModel):
    travel_style: str
    interests: List[str]
    trip_length: str

class UserPreferenceResponse(BaseModel):
    travel_style: str
    interests: List[str]
    trip_length: str
