from prisma import Prisma, types
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import bcrypt
from jose import jwt, JWTError
from datetime import date, datetime, time, timedelta, date as D, time as T
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from contextlib import asynccontextmanager
import subprocess
import sys

from routers import auth, customer, trip_group, budget, trip_plan, ai, cache, flight
from dependencies import load_cities_data, get_cities_list, cities_data, SECRET_KEY, ALGORITHM, get_db
from db import db
from get_location import sio
import socketio as _socketio

import os
import requests
import urllib.parse

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    load_cities_data()
    await db.connect()
    yield
    # --- shutdown ---
    await db.disconnect()
    cities_data.clear()
    

app = FastAPI(lifespan=lifespan)


if __name__ == "__main__":
    try:
        print("Starting server with socket_app...")
        uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
    except KeyboardInterrupt:
        pass
# class for request model


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Middleware ---
@app.middleware("http")
async def jwt_middleware(request: Request, call_next):
    # Routes that allow optional auth (decode token if present, but don't require it)
    OPTIONAL_AUTH = {"/attractions/"}
    # Routes that require no auth at all
    PUBLIC = {"/login", "/register", "/refresh-token", "/google-login", "/cities", "/explore-cities", "/trip_plan/ended", "/socket.io"}

    request.state.email = None

    auth = request.headers.get("Authorization")
    print(f"[AUTH] path={request.url.path} | has_auth={'yes' if auth else 'no'}")

    if auth and auth.startswith("Bearer "):
        token = auth.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            print(f"[AUTH] decoded email={email}")
            if email:
                async with Prisma() as _db:
                    user = await _db.customer.find_unique(where={"email": email})
                    print(f"[AUTH] user found={user is not None} | token_match={user.currentToken == token if user else False}")
                    if user and user.currentToken == token:
                        request.state.email = email
                        print(f"[AUTH] ✅ email set: {email}")
        except JWTError as e:
            print(f"[AUTH] ❌ JWTError: {e}")
        except Exception as e:
            print(f"[AUTH] ❌ Error: {e}")

    path = request.url.path
    if path in PUBLIC or path in OPTIONAL_AUTH:
        return await call_next(request)

    # Protected routes — require valid email
    if not request.state.email:
        return JSONResponse(status_code=401, content={"detail": "Missing or invalid token"})

    return await call_next(request)


# --- Routers ---
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(trip_group.router)
app.include_router(budget.router)
app.include_router(trip_plan.router)
app.include_router(ai.router)
app.include_router(cache.router)
app.include_router(flight.router)



@app.get("/cities")
def get_cities():
    data = get_cities_list()
    return {"items": [c.model_dump() for c in data], "total": len(data)}


# ── Mount Socket.IO on same port ──────────────────────────────────────────────
socket_app = _socketio.ASGIApp(sio, other_asgi_app=app)
