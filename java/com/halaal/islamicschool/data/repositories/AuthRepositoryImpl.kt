package com.halaal.islamicschool.data.repositories

import com.halaal.islamicschool.data.dataStore.DataStore
import com.halaal.islamicschool.domain.dto.LoginDto
import com.halaal.islamicschool.domain.dto.RegisterDto
import com.halaal.islamicschool.domain.dto.ResendCodeDto
import com.halaal.islamicschool.domain.dto.ResetPasswordDto
import com.halaal.islamicschool.domain.dto.VerifyDto
import com.halaal.islamicschool.domain.models.Token
import com.halaal.islamicschool.domain.models.User
import com.halaal.islamicschool.domain.repositories.AuthRepository
import com.halaal.islamicschool.domain.response.ApiResponse
import com.halaal.islamicschool.domain.response.MessageResponse
import com.zkrallah.zhttp.client.ZHttpClient

class AuthRepositoryImpl(
    private val zHttpClient: ZHttpClient,
    private val dataStore: DataStore
) : AuthRepository {

    override suspend fun registerStudent(
        email: String, password: String, firstName: String, lastName: String
    ): ApiResponse<User?>? {
        val registerDto = RegisterDto(email, password, firstName, lastName)
        val apiResponse = zHttpClient.post<ApiResponse<User?>>(
            "api/auth/student/signup", body = registerDto
        )

        return apiResponse?.body
    }

    override suspend fun registerTeacher(
        email: String, password: String, firstName: String, lastName: String
    ): ApiResponse<User?>? {
        val registerDto = RegisterDto(email, password, firstName, lastName)
        val apiResponse = zHttpClient.post<ApiResponse<User?>>(
            "api/auth/teacher/signup", body = registerDto
        )

        return apiResponse?.body
    }

    override suspend fun verifyCode(email: String, code: Int): ApiResponse<MessageResponse?>? {
        val verifyDto = VerifyDto(email, code)
        val apiResponse = zHttpClient.post<ApiResponse<MessageResponse?>>(
            "api/auth/verify-code", body = verifyDto
        )

        return apiResponse?.body
    }

    override suspend fun resendCode(email: String): ApiResponse<MessageResponse?>? {
        val resendCodeDto = ResendCodeDto(email)
        val apiResponse = zHttpClient.post<ApiResponse<MessageResponse?>>(
            "api/auth/regenerate-code", body = resendCodeDto
        )

        return apiResponse?.body
    }

    override suspend fun login(email: String, password: String): ApiResponse<Token?>? {
        val loginDto = LoginDto(email, password)
        val apiResponse = zHttpClient.post<ApiResponse<Token?>>("api/auth/login", body = loginDto)

        return apiResponse?.body
    }

    override suspend fun resetPassword(
        email: String, password: String, code: Int
    ): ApiResponse<MessageResponse?>? {
        val resetPasswordDto = ResetPasswordDto(email, password, code)
        val apiResponse = zHttpClient.post<ApiResponse<MessageResponse?>>(
            "api/auth/reset-password", body = resetPasswordDto
        )

        return apiResponse?.body
    }

    override suspend fun saveUser(user: User) {
        dataStore.saveUserModel(user)
    }

    override suspend fun setLoggedInDone() {
        dataStore.setIsLoggedIn(true)
    }

    override suspend fun saveUserData(data: Token) {
        dataStore.insertToken(data)
    }
}