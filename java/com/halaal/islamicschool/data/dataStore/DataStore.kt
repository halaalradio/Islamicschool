package com.halaal.islamicschool.data.dataStore

import com.halaal.islamicschool.domain.models.Token
import com.halaal.islamicschool.domain.models.User

interface DataStore {

    suspend fun saveUserModel(userModel: User?)

    suspend fun getUserModel():User

    suspend fun getIsOnBoardingFinished():Boolean

    suspend fun setIsOnBoardingFinished(isOnBoardingFinished:Boolean)

    suspend fun getIsLoggedIn(): Boolean

    suspend fun setIsLoggedIn(isLogged: Boolean)

    suspend fun insertToken(data: Token)

    suspend fun getToken(): String

    suspend fun logOut()
}