package com.halaal.islamicschool.domain.dto

data class RegisterDto(
    val email: String?,
    val password: String?,
    val firstName: String?,
    val lastName: String?
)