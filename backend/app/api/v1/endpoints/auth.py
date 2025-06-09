"""
Endpoints de autenticación
"""
from datetime import timedelta, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    get_current_user,
    get_current_active_user
)
from app.services.aps_auth import APSAuthService
from app.models.user import User
from app.schemas.auth import (
    Token, 
    UserCreate, 
    UserResponse, 
    APSTokenResponse,
    APSAuthRequest,
    APSUserInfo,
    AuthState
)

router = APIRouter()
logger = structlog.get_logger()


@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Endpoint de login para obtener token de acceso
    """
    try:
        # Buscar usuario en la base de datos
        user = db.query(User).filter(User.email == form_data.username).first()
        
        if not user or not verify_password(form_data.password, user.hashed_password):
            logger.warning("Intento de login fallido", username=form_data.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo"
            )
        
        # Crear token de acceso
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            subject=str(user.id), expires_delta=access_token_expires
        )
        
        # Actualizar último login
        user.last_login = datetime.utcnow()
        db.commit()
        
        logger.info("Usuario autenticado exitosamente", 
                   user_id=user.id, 
                   email=user.email)
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error durante login", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno durante autenticación"
        )


@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Registro de nuevo usuario
    """
    try:
        # Verificar si el usuario ya existe
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un usuario con este email"
            )
        
        # Crear nuevo usuario
        hashed_password = get_password_hash(user_data.password)
        
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=True,
            is_superuser=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info("Usuario registrado exitosamente", 
                   user_id=new_user.id,
                   email=new_user.email)
        
        return UserResponse(
            id=new_user.id,
            email=new_user.email,
            is_active=new_user.is_active,
            full_name=new_user.full_name,
            is_superuser=new_user.is_superuser,
            aps_user_id=new_user.aps_user_id,
            last_login=new_user.last_login.isoformat() if new_user.last_login else None,
            created_at=new_user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error durante registro", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno durante registro"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener información del usuario actual
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
        full_name=current_user.full_name,
        is_superuser=current_user.is_superuser,
        aps_user_id=current_user.aps_user_id,
        last_login=current_user.last_login.isoformat() if current_user.last_login else None,
        created_at=current_user.created_at.isoformat()
    )


@router.get("/state", response_model=AuthState)
async def get_auth_state(
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener estado completo de autenticación
    """
    user_response = UserResponse(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
        full_name=current_user.full_name,
        is_superuser=current_user.is_superuser,
        aps_user_id=current_user.aps_user_id,
        last_login=current_user.last_login.isoformat() if current_user.last_login else None,
        created_at=current_user.created_at.isoformat()
    )
    
    # Obtener información APS si está disponible
    aps_user = None
    if current_user.is_aps_authenticated:
        try:
            aps_service = APSAuthService()
            aps_user = await aps_service.get_user_info(current_user.aps_access_token)
        except Exception as e:
            logger.warning("Error al obtener info APS", error=str(e))
    
    return AuthState(
        is_authenticated=True,
        aps_authenticated=current_user.is_aps_authenticated,
        user=user_response,
        aps_user=aps_user
    )


@router.post("/token", response_model=APSTokenResponse)
async def get_aps_app_token():
    """
    Obtener token de aplicación APS (2-legged OAuth)
    """
    try:
        aps_service = APSAuthService()
        token = await aps_service.get_app_token()
        
        logger.info("Token de aplicación APS generado")
        return token
        
    except Exception as e:
        logger.error("Error al obtener token de aplicación APS", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener token de APS"
        )


@router.get("/aps/auth-url")
async def get_aps_auth_url(
    state: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener URL de autorización de APS/Forge (3-legged OAuth)
    """
    try:
        aps_service = APSAuthService()
        auth_url = aps_service.get_authorization_url(state=state)
        
        logger.info("URL de autorización APS generada", user_id=current_user.id)
        
        return {
            "auth_url": auth_url,
            "client_id": settings.APS_CLIENT_ID,
            "scopes": settings.APS_SCOPES,
            "state": state
        }
        
    except Exception as e:
        logger.error("Error al generar URL de autorización APS", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar URL de autorización"
        )


@router.post("/aps/callback")
async def aps_auth_callback(
    auth_request: APSAuthRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Callback de autorización de APS/Forge (3-legged OAuth)
    """
    try:
        aps_service = APSAuthService()
        
        # Intercambiar código por tokens
        token_response = await aps_service.exchange_code_for_token(auth_request.code)
        
        # Obtener información del usuario APS
        aps_user_info = await aps_service.get_user_info(token_response.access_token)
        
        # Actualizar usuario con tokens APS
        current_user.aps_user_id = aps_user_info.user_id
        current_user.aps_access_token = token_response.access_token
        current_user.aps_refresh_token = token_response.refresh_token
        current_user.aps_token_expires_at = datetime.utcnow() + timedelta(
            seconds=token_response.expires_in
        )
        
        db.commit()
        
        logger.info("Autorización APS completada exitosamente",
                   user_id=current_user.id,
                   aps_user_id=aps_user_info.user_id)
        
        return {
            "message": "Autorización de APS completada exitosamente",
            "aps_user": aps_user_info,
            "expires_in": token_response.expires_in
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error durante callback de APS", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar autorización de APS"
        )


@router.post("/aps/refresh")
async def refresh_aps_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Refrescar token de APS usando refresh token
    """
    try:
        if not current_user.aps_refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay refresh token disponible"
            )
        
        aps_service = APSAuthService()
        token_response = await aps_service.refresh_user_token(
            current_user.aps_refresh_token
        )
        
        # Actualizar tokens
        current_user.aps_access_token = token_response.access_token
        if token_response.refresh_token:
            current_user.aps_refresh_token = token_response.refresh_token
        current_user.aps_token_expires_at = datetime.utcnow() + timedelta(
            seconds=token_response.expires_in
        )
        
        db.commit()
        
        logger.info("Token APS refrescado exitosamente", user_id=current_user.id)
        
        return {
            "message": "Token APS refrescado exitosamente",
            "expires_in": token_response.expires_in
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error al refrescar token APS", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al refrescar token de APS"
        )


@router.delete("/aps/revoke")
async def revoke_aps_authorization(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Revocar autorización de APS
    """
    try:
        # Limpiar tokens APS
        current_user.aps_user_id = None
        current_user.aps_access_token = None
        current_user.aps_refresh_token = None
        current_user.aps_token_expires_at = None
        
        db.commit()
        
        logger.info("Autorización APS revocada", user_id=current_user.id)
        
        return {"message": "Autorización de APS revocada exitosamente"}
        
    except Exception as e:
        db.rollback()
        logger.error("Error al revocar autorización APS", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al revocar autorización de APS"
        )