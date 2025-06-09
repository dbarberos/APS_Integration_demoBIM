"""
Módulo de seguridad y autenticación
"""
from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = structlog.get_logger()

# Configuración de hashing de passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configuración de JWT Bearer
security = HTTPBearer()


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    """Crear token de acceso JWT"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar password"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Obtener hash de password"""
    return pwd_context.hash(password)


def verify_token(token: str) -> Optional[str]:
    """Verificar y decodificar token JWT"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError as e:
        logger.warning("Error al verificar token JWT", error=str(e))
        return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Obtener usuario actual desde token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        user_id = verify_token(credentials.credentials)
        if user_id is None:
            raise credentials_exception
        
        # Obtener usuario de la base de datos
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise credentials_exception
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo"
            )
        
        # Agregar user_id al request state para middleware
        request.state.user_id = user.id
        
        # Actualizar último login
        user.last_login = datetime.utcnow()
        db.commit()
        
        return user
        
    except ValueError:
        raise credentials_exception
    except Exception as e:
        logger.error("Error al obtener usuario actual", error=str(e))
        raise credentials_exception


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Obtener usuario actual activo"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """Obtener usuario actual que sea superusuario"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador"
        )
    return current_user


def require_aps_auth(user: User) -> User:
    """Verificar que el usuario tenga autorización APS válida"""
    if not user.is_aps_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Autorización APS requerida. Por favor autoriza la aplicación con Autodesk."
        )
    return user


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Obtener usuario actual opcional (para endpoints públicos)"""
    if not credentials:
        return None
    
    try:
        user_id = verify_token(credentials.credentials)
        if user_id is None:
            return None
        
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user and user.is_active:
            request.state.user_id = user.id
            return user
        
    except Exception as e:
        logger.debug("Error al obtener usuario opcional", error=str(e))
    
    return None


# Funciones específicas para APS/Forge
def validate_aps_token(token: str) -> bool:
    """Validar token de APS/Forge"""
    # Implementar validación específica de APS
    # Por ahora, validación básica
    return len(token) > 0


def create_aps_auth_url() -> str:
    """Crear URL de autorización para APS"""
    scopes = " ".join(settings.APS_SCOPES)
    return (
        f"{settings.APS_AUTH_URL}?"
        f"client_id={settings.APS_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={settings.APS_CALLBACK_URL}&"
        f"scope={scopes}"
    )