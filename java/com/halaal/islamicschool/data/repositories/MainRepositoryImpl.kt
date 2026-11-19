package com.halaal.islamicschool.data.repositories

import com.halaal.islamicschool.data.dataStore.DataStore
import com.halaal.islamicschool.domain.repositories.MainRepository

class MainRepositoryImpl(
    private val dataStore: DataStore
) : MainRepository {
    override suspend fun getOnBoardingDone(): Boolean {
        return dataStore.getIsOnBoardingFinished()
    }

    override suspend fun setOnBoardingDone() {
        dataStore.setIsOnBoardingFinished(true)
    }

    override suspend fun getLoggedInDone(): Boolean {
        return dataStore.getIsLoggedIn()
    }
}