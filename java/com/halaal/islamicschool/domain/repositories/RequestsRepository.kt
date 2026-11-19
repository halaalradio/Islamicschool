package com.halaal.islamicschool.domain.repositories

import com.halaal.islamicschool.domain.models.Request
import com.halaal.islamicschool.domain.response.ApiResponse

interface RequestsRepository {
    suspend fun getUserRequests(): ApiResponse<List<Request>?>?
}