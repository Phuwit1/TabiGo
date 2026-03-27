from typing import Union, Dict, Any
from fastapi import FastAPI, HTTPException, Depends
import requests
import os
from dotenv import load_dotenv, dotenv_values
from pydantic import BaseModel
from openai import OpenAI
import json

load_dotenv()

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class RouteSummarizeRequest(BaseModel):
    route: Dict[str, Any]

class RouteRequest(BaseModel):
    start: str
    goal: str
    start_time: str

async def route(text: RouteRequest = Depends()):
    url = "https://navitime-route-totalnavi.p.rapidapi.com/route_transit"
    rapidapi_key = os.getenv("RAPIDAPI_KEY")

    querystring = {"start": text.start,"goal": text.goal,"datum":"wgs84","term":"1440","limit":"5","start_time": text.start_time,"coord_unit":"degree"}

    headers = {
        "x-rapidapi-key": rapidapi_key,
        "x-rapidapi-host": "navitime-route-totalnavi.p.rapidapi.com"
    }

    response = requests.get(url, headers=headers, params=querystring)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": "Failed to fetch data from the API", "status_code": response.status_code}


async def route_summarize(text: RouteSummarizeRequest):
    json_structure = """
        [
            {
                "title": "Option 1: Fastest (44 min, 1 transfer)",
                "detail": [
                    "Walk: From origin to Nishi-Nippori Station (5 min)",
                    "JR Yamanote Line: Nishi-Nippori to Ikebukuro (10 min)",
                    "Seibu Ikebukuro Line: Ikebukuro to Nerima (12 min)",
                    "Seibu Toshima Line: Nerima to Toshimaen (2 min)",
                    "Walk: To destination (4 min)"
                ],
                "fare": "Total Fare: ~360 JPY",
                "distance": "Distance: 13.5 km"
            },
            {
                "......**another option**......"
            },
            {
                "......**another option**......"
            }
        ]
    """
    prompt = f"""
        Summarize this JSON file {text.route} into a clear, human-readable, easy-to-read route guide.

        - Translate all Japanese to English.

        - Do NOT use any emojis. Use plain text only.

        - For fare/cost information: the fare data contains multiple "unit" keys (unit_0, unit_1, unit_2, etc.) representing different passenger types. Always use ONLY unit_0 (adult fare) and display it as a single value like "Total Fare: ~7140 JPY". Do NOT list multiple units.

        - Return the result strictly as a JSON array only — no extra comments or explanations outside the JSON format.

        Example JSON Format: {json_structure}

        Ensure the response **ONLY** contains valid JSON without any explanations or additional text.

        *** NO double quotes at the start and end of the JSON response. ***

        Make the response in English language.
    """

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content" : "You are an assistant that helps to traslate and summarize a route JSON from Japanese to English."},
            # {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip to **thai language**."},
            {"role": "user", "content" : prompt},
        ]
    )
    
    # response_answer = "[  {    \"title\": \"🚆 Option 1: Fewest Transfers (⏱ 44 min, 🔁 1 transfer)\",    \"detail\": [      \"🚶‍♂️ Walk: From Start to Nishi-Nippori Station (5 min, 237 m)\",      \"🚃 JR Yamanote Line: Nishi-Nippori → Ikebukuro (10 min, 6.0 km)\",      \"🚃 Seibu Ikebukuro Line: Ikebukuro → Nerima (12 min, 6.0 km)\",      \"🚃 Seibu Toshima Line: Nerima → Toshimaen (2 min, 1.0 km)\",      \"🚶‍♂️ Walk: To Goal (4 min, 284 m)\"    ],    \"fare\": \"💴 Total Fare: ~¥360\",    \"distance\": \"📏 Distance: 13.5 km\"  },  {    \"title\": \"🚆 Option 2: Two Transfers (⏱ 52 min, 🔁 2 transfers)\",    \"detail\": [      \"🚶‍♂️ Walk: From Start to Nishi-Nippori Station (5 min, 237 m)\",      \"🚃 JR Yamanote Line: Nishi-Nippori → Ikebukuro (10 min, 6.0 km)\",      \"🚃 Tokyo Metro Yurakucho Line: Ikebukuro → Kotake-Mukaihara (7 min, 3.2 km)\",      \"🚃 Seibu Yurakucho Line: Kotake-Mukaihara → Nerima (5 min, 2.6 km)\",      \"🚃 Seibu Toshima Line: Nerima → Toshimaen (2 min, 1.0 km)\",      \"🚶‍♂️ Walk: To Goal (4 min, 284 m)\"    ],    \"fare\": \"💴 Total Fare: ~¥510\",    \"distance\": \"📏 Distance: 13.3 km\"  },  {    \"title\": \"🚆 Option 3: One Transfer with Longer Walk (⏱ 57 min, 🔁 1 transfer)\",    \"detail\": [      \"🚶‍♂️ Walk: From Start to Nishi-Nippori Station (5 min, 237 m)\",      \"🚃 JR Yamanote Line: Nishi-Nippori → Ikebukuro (10 min, 6.0 km)\",      \"🚃 Tokyo Metro Fukutoshin Line: Ikebukuro → Kotake-Mukaihara (5 min, 3.2 km)\",      \"🚃 Seibu Yurakucho Line: Kotake-Mukaihara → Nerima (5 min, 2.6 km)\",      \"🚶‍♂️ Walk: Nerima Station South Exit → Goal (19 min, 1.4 km)\"    ],    \"fare\": \"💴 Total Fare: ~¥510\",    \"distance\": \"📏 Distance: 13.4 km\"  },  {    \"title\": \"🚆 Option 4: Two Transfers with Rapid Trains (⏱ 57 min, 🔁 2 transfers)\",    \"detail\": [      \"🚶‍♂️ Walk: From Start to Nishi-Nippori Station (5 min, 237 m)\",      \"🚃 JR Yamanote Line: Nishi-Nippori → Ikebukuro (10 min, 6.0 km)\",      \"🚃 Tokyo Metro Fukutoshin Line (Rapid): Ikebukuro → Kotake-Mukaihara (4 min, 3.2 km)\",      \"🚃 Seibu Ikebukuro Line Rapid Express: Kotake-Mukaihara → Nerima (5 min, 2.6 km)\",      \"🚃 Seibu Toshima Line: Nerima → Toshimaen (2 min, 1.0 km)\",      \"🚶‍♂️ Walk: To Goal (4 min, 284 m)\"    ],    \"fare\": \"💴 Total Fare: ~¥510\",    \"distance\": \"📏 Distance: 13.3 km\"  },  {    \"title\": \"🚆 Option 5: Three Transfers (⏱ 57 min, 🔁 3 transfers)\",    \"detail\": [      \"🚶‍♂️ Walk: From Start to Nishi-Nippori Station (5 min, 237 m)\",      \"🚃 JR Yamanote Line: Nishi-Nippori → Otsuka (Tokyo) (8 min, 4.2 km)\",      \"🚶‍♂️ Walk: Otsuka → Otsuka-Ekimae Tram Stop (2 min, 154 m)\",      \"🚃 Toden Arakawa Line: Otsuka-Ekimae → Higashi-Ikebukuro 4-chome (5 min, 1.1 km)\",      \"🚶‍♂️ Walk: Higashi-Ikebukuro 4-chome → Higashi-Ikebukuro Station (2 min, 203 m)\",      \"🚃 Tokyo Metro Yurakucho Line: Higashi-Ikebukuro → Ikebukuro (2 min, 900 m)\",      \"🚃 Seibu Ikebukuro Line: Ikebukuro → Nerima (12 min, 6.0 km)\",      \"🚃 Seibu Toshima Line: Nerima → Toshimaen (2 min, 1.0 km)\",      \"🚶‍♂️ Walk: To Goal (4 min, 284 m)\"    ],    \"fare\": \"💴 Total Fare: ~¥710\",    \"distance\": \"📏 Distance: 14.1 km\"  }]"
    
    response_answer = response.choices[0].message.content
    response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    if response_answer.startswith('json'):
        response_answer = response_answer[4:]
    # return response_answer
    try:
        data = json.loads(response_answer)
        print("Method 1 successful")
    except json.JSONDecodeError as e:
        print(f"Method 1 failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse JSON from model response")
    return data
    
    
    # response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    # if response_answer.startswith('json'):
    #     response_answer = response_answer[4:]
    # # return response_answer
    # try:
    #     data = json.loads(response_answer)
    #     print("Method 1 successful")
    # except json.JSONDecodeError as e:
    #     print(f"Method 1 failed: {e}")
    #     raise HTTPException(status_code=500, detail="Failed to parse JSON from model response")

    # return data
