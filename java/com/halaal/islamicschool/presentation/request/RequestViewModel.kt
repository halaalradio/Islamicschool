package com.halaal.islamicschool.presentation.request

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.halaal.islamicschool.domain.models.Request
import com.halaal.islamicschool.domain.repositories.RequestsRepository
import com.halaal.islamicschool.domain.response.ApiResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RequestViewModel @Inject constructor(
    private val requestsRepository: RequestsRepository
) : ViewModel() {
    private val _getRequestsStatus: MutableStateFlow<ApiResponse<List<Request>?>?> = MutableStateFlow(null)
    val getRequestsStatus: StateFlow<ApiResponse<List<Request>?>?> = _getRequestsStatus

    init {
        viewModelScope.launch {
            _getRequestsStatus.emit(requestsRepository.getUserRequests())
        }
    }

    suspend fun refresh() {
        _getRequestsStatus.emit(requestsRepository.getUserRequests())
    }
}