package com.halaal.islamicschool.di

import com.halaal.islamicschool.data.dataStore.DataStore
import com.halaal.islamicschool.data.repositories.AuthRepositoryImpl
import com.halaal.islamicschool.data.repositories.BrowseRepositoryImpl
import com.halaal.islamicschool.data.repositories.ClassRepositoryImpl
import com.halaal.islamicschool.data.repositories.MainRepositoryImpl
import com.halaal.islamicschool.data.repositories.RequestRepositoryImpl
import com.halaal.islamicschool.data.repositories.TaskRepositoryImpl
import com.halaal.islamicschool.data.repositories.UserRepositoryImpl
import com.halaal.islamicschool.domain.repositories.AuthRepository
import com.halaal.islamicschool.domain.repositories.BrowseRepository
import com.halaal.islamicschool.domain.repositories.ClassRepository
import com.halaal.islamicschool.domain.repositories.MainRepository
import com.halaal.islamicschool.domain.repositories.RequestsRepository
import com.halaal.islamicschool.domain.repositories.TaskRepository
import com.halaal.islamicschool.domain.repositories.UserRepository
import com.zkrallah.zhttp.client.ZHttpClient
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton


@Module
@InstallIn(SingletonComponent::class)
object RepositoriesModule {

    @Provides
    @Singleton
    fun provideMainRepository(
        dataStore: DataStore
    ): MainRepository {
        return MainRepositoryImpl(dataStore)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        zHttpClient: ZHttpClient,
        dataStore: DataStore
    ): AuthRepository {
        return AuthRepositoryImpl(zHttpClient, dataStore)
    }

    @Provides
    @Singleton
    fun provideUserRepository(
        zHttpClient: ZHttpClient,
        dataStore: DataStore
    ): UserRepository {
        return UserRepositoryImpl(zHttpClient, dataStore)
    }

    @Provides
    @Singleton
    fun provideBrowseRepository(
        zHttpClient: ZHttpClient,
        dataStore: DataStore
    ): BrowseRepository {
        return BrowseRepositoryImpl(zHttpClient, dataStore)
    }

    @Provides
    @Singleton
    fun provideRequestRepository(
        zHttpClient: ZHttpClient,
        dataStore: DataStore
    ): RequestsRepository {
        return RequestRepositoryImpl(zHttpClient, dataStore)
    }

    @Provides
    @Singleton
    fun provideClassRepository(
        zHttpClient: ZHttpClient,
        dataStore: DataStore
    ): ClassRepository {
        return ClassRepositoryImpl(zHttpClient, dataStore)
    }

    @Provides
    @Singleton
    fun provideTaskRepository(
        zHttpClient: ZHttpClient,
        dataStore: DataStore
    ): TaskRepository {
        return TaskRepositoryImpl(zHttpClient, dataStore)
    }
}