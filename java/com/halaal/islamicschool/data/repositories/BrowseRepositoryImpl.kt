package com.halaal.islamicschool.data.repositories

import com.halaal.islamicschool.data.dataStore.DataStore
import com.halaal.islamicschool.domain.dto.ClassDto
import com.halaal.islamicschool.domain.models.Class
import com.halaal.islamicschool.domain.models.Request
import com.halaal.islamicschool.domain.repositories.BrowseRepository
import com.halaal.islamicschool.domain.response.ApiResponse
import com.zkrallah.zhttp.model.Header
import com.zkrallah.zhttp.client.ZHttpClient

class BrowseRepositoryImpl(
    private val zHttpClient: ZHttpClient,
    private val dataStore: DataStore
) : BrowseRepository {
    override suspend fun getClasses(): ApiResponse<List<Class>?>? {
        val token = dataStore.getToken()
        val headers = listOf(
            Header("Authorization", "Bearer $token")
        )

        val apiResponse =
            zHttpClient.get<ApiResponse<List<Class>?>>("api/classes", headers = headers)

        return apiResponse?.body
    }

    override suspend fun submitRequest(classId: Long): ApiResponse<Request?>? {
        val token = dataStore.getToken()
        val headers = listOf(
            Header("Authorization", "Bearer $token")
        )
        val userId = dataStore.getUserModel().id

        val apiResponse = zHttpClient.post<ApiResponse<Request?>>(
            "api/users/request/$userId/to/$classId", body = Unit, headers = headers
        )

        return apiResponse?.body
    }

    override suspend fun addClass(name: String, description: String): ApiResponse<Class?>? {
        val token = dataStore.getToken()
        val headers = listOf(
            Header("Authorization", "Bearer $token")
        )

        val classDto = ClassDto(name, description)

        val apiResponse = zHttpClient.post<ApiResponse<Class?>>(
            "api/admin/create-class", body = classDto, headers = headers
        )

        return apiResponse?.body
    }

    override suspend fun getUserRole(): String {
        return dataStore.getUserModel().authorities?.get(0)?.name ?: "STUDENT"
    }
}