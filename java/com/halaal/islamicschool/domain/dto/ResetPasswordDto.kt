package com.halaal.islamicschool.domain.dto

data class ResetPasswordDto(
    val email: String?,
    val password: String?,
    val code: Int?
)
