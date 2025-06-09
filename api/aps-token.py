"""
API para obtener tokens de Autodesk Platform Services
"""
import json
import os
import requests
from typing import Dict, Any
def handler(request):
    """Obtener token APS para el frontend"""
    try:
        if request.method != 'GET':
            return {
                'statusCode': 405,
                'body': json.dumps({'error': 'Method not allowed'})
            }
        
        # Obtener token 2-legged de APS
        token_data = get_aps_token()
        
        if token_data:
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                'body': json.dumps(token_data)
            }
        else:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to obtain APS token'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
def get_aps_token() -> Dict[str, Any]:
    """Obtener token de APS usando credenciales de la app"""
    url = "https://developer.api.autodesk.com/authentication/v1/authenticate"
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }
    
    data = {
        'client_id': os.environ['APS_CLIENT_ID'],
        'client_secret': os.environ['APS_CLIENT_SECRET'],
        'grant_type': 'client_credentials',
        'scope': 'viewables:read data:read data:write bucket:create bucket:read'
    }
    
    try:
        response = requests.post(url, headers=headers, data=data, timeout=8)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"APS Auth Error: {response.status_code} - {response.text}")
            return None
            
    except requests.RequestException as e:
        print(f"Request error: {e}")
        return None
