package com.halaal.islamicschool.presentation.user

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.halaal.islamicschool.domain.models.User
import com.halaal.islamicschool.domain.repositories.UserRepository
import com.halaal.islamicschool.domain.response.ApiResponse
import com.halaal.islamicschool.domain.response.MessageResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UserViewModel @Inject constructor(
    private val userRepository: UserRepository
): ViewModel() {
    private val _getUserStatus: MutableStateFlow<ApiResponse<User?>?> = MutableStateFlow(null)
    val getUserStatus: StateFlow<ApiResponse<User?>?> = _getUserStatus

    private val _updateUserStatus: MutableStateFlow<ApiResponse<User?>?> = MutableStateFlow(null)
    val updateUserStatus: StateFlow<ApiResponse<User?>?> = _updateUserStatus

    private val _uploadPhotoStatus: MutableStateFlow<ApiResponse<MessageResponse?>?> = MutableStateFlow(null)
    val uploadPhotoStatus: StateFlow<ApiResponse<MessageResponse?>?> = _uploadPhotoStatus


    fun getCurrentUser() {
        viewModelScope.launch {
            _getUserStatus.emit(userRepository.getCurrentUser())
        }
    }

    fun updateUser(firstName: String, lastName: String, dob: String) {
        viewModelScope.launch {
            _updateUserStatus.emit(userRepository.updateUser(firstName, lastName, dob))
        }
    }

    fun uploadPhoto(filePath: String) {
        viewModelScope.launch {
            _uploadPhotoStatus.emit(userRepository.uploadProfilePicture(filePath))
        }
    }

    fun logOut() {
        viewModelScope.launch {
            userRepository.logOut()
        }
    }

    fun resetUpdateUserStatus() {
        _updateUserStatus.value = null
    }

    fun resetUploadPhotoStatus() {
        _uploadPhotoStatus.value = null
    }
}