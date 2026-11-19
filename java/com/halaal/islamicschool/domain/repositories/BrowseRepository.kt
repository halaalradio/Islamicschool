package com.halaal.islamicschool.domain.repositories

import com.halaal.islamicschool.domain.models.Class
import com.halaal.islamicschool.domain.models.Request
import com.halaal.islamicschool.domain.response.ApiResponse

interface BrowseRepository {
    suspend fun getClasses(): ApiResponse<List<Class>?>?

    suspend fun submitRequest(classId: Long): ApiResponse<Request?>?

    suspend fun addClass(name: String, description: String): ApiResponse<Class?>?

    suspend fun getUserRole(): String
}