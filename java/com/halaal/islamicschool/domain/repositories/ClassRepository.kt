package com.halaal.islamicschool.domain.repositories

import com.halaal.islamicschool.domain.models.Announcement
import com.halaal.islamicschool.domain.models.Class
import com.halaal.islamicschool.domain.models.Request
import com.halaal.islamicschool.domain.models.Task
import com.halaal.islamicschool.domain.models.User
import com.halaal.islamicschool.domain.response.ApiResponse

interface ClassRepository {
    suspend fun getUserClasses(): ApiResponse<List<Class>?>?

    suspend fun getClassMembers(classId: Long): ApiResponse<List<User>?>?

    suspend fun getClassAnnouncements(classId: Long): ApiResponse<List<Announcement>?>?

    suspend fun getClassTasks(classId: Long): ApiResponse<List<Task>?>?

    suspend fun getUserRole(): String

    suspend fun getClassRequests(classId: Long): ApiResponse<List<Request>?>?

    suspend fun approveRequest(requestId: Long): ApiResponse<Request?>?

    suspend fun declineRequest(requestId: Long): ApiResponse<Request?>?

    suspend fun addTask(
        classId: Long,
        title: String,
        desc: String,
        due: String
    ): ApiResponse<Task?>?

    suspend fun addAnnouncement(
        classId: Long,
        title: String,
        content: String
    ): ApiResponse<Announcement?>?
}