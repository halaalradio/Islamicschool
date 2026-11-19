package com.halaal.islamicschool.di

import android.content.Context
import com.halaal.islamicschool.BASE_URL
import com.halaal.islamicschool.data.dataStore.DataStore
import com.halaal.islamicschool.data.dataStore.DataStoreImpl
import com.zkrallah.zhttp.client.ZHttpClient
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object Module {

    @Provides
    @Singleton
    fun provideZHttpClient(): ZHttpClient {
        return ZHttpClient.Builder()
            .baseUrl(BASE_URL)
            .connectionTimeout(20000)
            .readTimeout(20000)
            .build()
    }

    @Provides
    @Singleton
    fun provideDataStore(
        @ApplicationContext appContext: Context
    ): DataStore {
        return DataStoreImpl(appContext)
    }

    @Provides
    @Singleton
    fun provideContext(
        @ApplicationContext appContext: Context
    ): Context {
        return appContext
    }
}