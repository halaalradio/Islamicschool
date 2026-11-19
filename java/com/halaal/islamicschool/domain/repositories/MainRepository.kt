package com.halaal.islamicschool.domain.repositories

interface MainRepository {
    suspend fun getOnBoardingDone(): Boolean

    suspend fun setOnBoardingDone()

    suspend fun getLoggedInDone(): Boolean
}