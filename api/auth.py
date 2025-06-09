"""
API de autenticación para Vercel Functions
Versión simplificada del backend FastAPI
"""
import json
import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
def handler(request):
    """Handler principal para Vercel Functions"""
    try:
        # Solo permitir POST
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'body': json.dumps({'error': 'Method not allowed'})
            }
        
        # Obtener datos del request
        body = json.loads(request.body)
        action = body.get('action')
        
        if action == 'login':
            return login(body)
        elif action == 'register':
            return register(body)
        elif action == 'verify':
            return verify_token(body)
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid action'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
def get_db_connection():
    """Conectar a Supabase PostgreSQL"""
    return psycopg2.connect(
        host=os.environ['SUPABASE_HOST'],
        database=os.environ['SUPABASE_DB'],
        user=os.environ['SUPABASE_USER'],
        password=os.environ['SUPABASE_PASSWORD'],
        port=5432
    )
def login(data: Dict[str, Any]):
    """Proceso de login"""
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Email and password required'})
        }
    
    # Conectar a BD
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Buscar usuario
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        
        if not user:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Invalid credentials'})
            }
        
        # Verificar contraseña
        if not bcrypt.checkpw(password.encode('utf-8'), user['hashed_password'].encode('utf-8')):
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Invalid credentials'})
            }
        
        # Generar JWT token
        token = jwt.encode({
            'user_id': user['id'],
            'email': user['email'],
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, os.environ['JWT_SECRET'], algorithm='HS256')
        
        # Actualizar last_login
        cur.execute(
            "UPDATE users SET last_login = %s WHERE id = %s",
            (datetime.utcnow(), user['id'])
        )
        conn.commit()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'token': token,
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name']
                }
            })
        }
        
    finally:
        cur.close()
        conn.close()
def register(data: Dict[str, Any]):
    """Proceso de registro"""
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name', '')
    
    if not email or not password:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Email and password required'})
        }
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Verificar si el email ya existe
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Email already registered'})
            }
        
        # Crear usuario
        cur.execute(
            """INSERT INTO users (email, hashed_password, full_name, created_at) 
               VALUES (%s, %s, %s, %s) RETURNING id, email, full_name""",
            (email, hashed_password.decode('utf-8'), full_name, datetime.utcnow())
        )
        
        new_user = cur.fetchone()
        conn.commit()
        
        # Generar token
        token = jwt.encode({
            'user_id': new_user['id'],
            'email': new_user['email'],
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, os.environ['JWT_SECRET'], algorithm='HS256')
        
        return {
            'statusCode': 201,
            'body': json.dumps({
                'token': token,
                'user': {
                    'id': new_user['id'],
                    'email': new_user['email'],
                    'full_name': new_user['full_name']
                }
            })
        }
        
    finally:
        cur.close()
        conn.close()
def verify_token(data: Dict[str, Any]):
    """Verificar token JWT"""
    token = data.get('token')
    
    if not token:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Token required'})
        }
    
    try:
        payload = jwt.decode(token, os.environ['JWT_SECRET'], algorithms=['HS256'])
        return {
            'statusCode': 200,
            'body': json.dumps({'valid': True, 'user_id': payload['user_id']})
        }
    except jwt.ExpiredSignatureError:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Token expired'})
        }
    except jwt.InvalidTokenError:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Invalid token'})
        }
