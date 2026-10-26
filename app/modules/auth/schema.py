from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


# Data recieved when registering
class SignupUser(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    password_repeat: str = Field(min_length=8)

    @model_validator(mode="after")
    def check_password_match(self) -> Self:
        if self.password != self.password_repeat:
            raise ValueError("Passwords do not match!")
        return self


# Data for login
class LoginUser(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime
