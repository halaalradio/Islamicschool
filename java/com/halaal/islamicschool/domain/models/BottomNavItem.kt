package com.halaal.islamicschool.domain.models

data class BottomNavItem(
    val name: String,
    val route: String,
    val selectedIcon: Int,
    val unSelectedIcon: Int
)