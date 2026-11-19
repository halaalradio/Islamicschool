package com.halaal.islamicschool.data.repositories

import com.halaal.islamicschool.data.dataStore.DataStore
import com.halaal.islamicschool.domain.models.Request
import com.halaal.islamicschool.domain.repositories.RequestsRepository
import com.halaal.islamicschool.domain.response.ApiResponse
import com.zkrallah.zhttp.model.Header
import com.zkrallah.zhttp.client.ZHttpClient

class RequestRepositoryImpl(
    private val zHttpClient: ZHttpClient,
    private val dataStore: DataStore
) : RequestsRepository {
    override suspend fun getUserRequests(): ApiResponse<List<Request>?>? {
        val token = dataStore.getToken()
        val headers = listOf(
            Header("Authorization", "Bearer $token")
        )
        val userId = dataStore.getUserModel().id

        val apiResponse = zHttpClient.get<ApiResponse<List<Request>?>>(
            "api/users/$userId/requests", headers = headers
        )

        return apiResponse?.body
    }
}