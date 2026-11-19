package com.halaal.islamicschool.domain.repositories

import com.halaal.islamicschool.domain.models.User
import com.halaal.islamicschool.domain.response.ApiResponse
import com.halaal.islamicschool.domain.response.MessageResponse

interface UserRepository {
    suspend fun getCurrentUser(): ApiResponse<User?>?

    suspend fun updateUser(firstName: String, lastName: String, dob: String): ApiResponse<User?>?

    suspend fun uploadProfilePicture(filePath: String): ApiResponse<MessageResponse?>?

    suspend fun logOut()
}