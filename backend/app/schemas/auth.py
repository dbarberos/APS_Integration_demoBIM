"""
Esquemas Pydantic para autenticación
"""
from typing import Optional
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """Esquema para token de acceso"""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Esquema para datos del token"""
    username: Optional[str] = None


class UserBase(BaseModel):
    """Esquema base de usuario"""
    email: EmailStr
    is_active: bool = True


class UserCreate(UserBase):
    """Esquema para creación de usuario"""
    password: str
    full_name: Optional[str] = None


class UserUpdate(UserBase):
    """Esquema para actualización de usuario"""
    password: Optional[str] = None
    full_name: Optional[str] = None


class UserInDBBase(UserBase):
    """Esquema base para usuario en BD"""
    id: int
    
    class Config:
        from_attributes = True


class User(UserInDBBase):
    """Esquema público de usuario"""
    pass


class UserInDB(UserInDBBase):
    """Esquema completo de usuario en BD"""
    hashed_password: str


class UserResponse(BaseModel):
    """Esquema de respuesta de usuario"""
    id: int
    email: EmailStr
    is_active: bool
    full_name: Optional[str] = None
    is_superuser: bool = False
    aps_user_id: Optional[str] = None
    last_login: Optional[str] = None
    created_at: str


class APSTokenResponse(BaseModel):
    """Esquema de respuesta de token APS"""
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None


class APSUserInfo(BaseModel):
    """Esquema de información de usuario APS"""
    user_id: str
    user_name: str
    email_id: str
    first_name: str
    last_name: str
    profile_images: Optional[dict] = None


class APSAuthRequest(BaseModel):
    """Esquema de solicitud de autorización APS"""
    code: str
    state: Optional[str] = None


class AuthState(BaseModel):
    """Esquema de estado de autenticación"""
    is_authenticated: bool
    aps_authenticated: bool
    user: Optional[UserResponse] = None
    aps_user: Optional[APSUserInfo] = None