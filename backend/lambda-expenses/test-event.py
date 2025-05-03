from main import handler  
import json

mock_event = {
    "queryStringParameters": {
        "action": "classify-expenses"
    }
}
mock_context = {}

response = handler(mock_event, mock_context)

print(json.dumps(response, indent=2))
