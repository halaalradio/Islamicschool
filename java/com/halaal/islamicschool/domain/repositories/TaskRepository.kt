package com.halaal.islamicschool.domain.repositories

import com.halaal.islamicschool.domain.models.Source
import com.halaal.islamicschool.domain.models.Submission
import com.halaal.islamicschool.domain.models.Task
import com.halaal.islamicschool.domain.response.ApiResponse

interface TaskRepository {
    suspend fun getUserRole(): String

    suspend fun getTask(taskId: Long): ApiResponse<Task?>?

    suspend fun addSource(taskId: Long, source: String): ApiResponse<Source?>?

    suspend fun getTaskSubmissions(taskId: Long): ApiResponse<List<Submission>?>?

    suspend fun updateSubmission(
        submissionId: Long,
        link: String,
        grade: Int,
        additional: String
    ): ApiResponse<Submission?>?

    suspend fun addSubmission(
        taskId: Long,
        link: String,
        additional: String
    ): ApiResponse<Submission?>?

    suspend fun getUserTaskSubmissions(taskId: Long): ApiResponse<List<Submission>?>?
}