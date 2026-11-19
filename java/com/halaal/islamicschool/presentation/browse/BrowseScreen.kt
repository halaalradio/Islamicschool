
package com.halaal.islamicschool.presentation.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.halaal.islamicschool.R
import com.halaal.islamicschool.presentation.dialog.AddClassDialog
import com.halaal.islamicschool.showToast
import kotlinx.coroutines.launch

@Composable
fun BrowseScreen(
    browseViewModel: BrowseViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        browseViewModel.getUserRole()
    }

    val userRoleStatus =
        browseViewModel.userRoleStatus.collectAsState()

    val getClassesStatus =
        browseViewModel.getClassesStatus.collectAsState()

    val addClassStatus =
        browseViewModel.addClassStatus.collectAsState()

    val submitRequestStatus =
        browseViewModel.submitRequestStatus.collectAsState()

    val lazyListState = rememberLazyListState()

    val showAddClassDialog = remember {
        mutableStateOf(false)
    }

    // Request status
    submitRequestStatus.value?.let { apiResponse ->

        if (apiResponse.success) {
            apiResponse.data?.let { request ->
                showToast(
                    context,
                    "Request to ${request.requestedClass?.name ?: ""} created!"
                )
            }
        } else {
            showToast(context, apiResponse.message)
        }

        browseViewModel.resetSubmitRequestStatus()
    }

    // Add class status
    addClassStatus.value?.let { apiResponse ->

        if (apiResponse.success) {
            showToast(
                context,
                "${apiResponse.data?.name ?: ""} Created!"
            )
        } else {
            showToast(
                context,
                "Failed to Create Class: ${apiResponse.message}"
            )
        }

        browseViewModel.resetAddClassStatus()
    }

    Scaffold(
        floatingActionButton = {
            if (userRoleStatus.value != "STUDENT") {
                FloatingActionButton(
                    onClick = {
                        showAddClassDialog.value = true
                    }
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Add,
                        contentDescription = "Post or Upload"
                    )
                }
            }
        }
    ) { innerPadding ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {

            // Refresh button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        horizontal = 16.dp,
                        vertical = 8.dp
                    ),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(
                    onClick = {
                        coroutineScope.launch {
                            browseViewModel.refresh()
                        }
                    }
                ) {
                    Text(text = "Refresh")
                }
            }

            LazyColumn(
                state = lazyListState,
                modifier = Modifier.fillMaxSize()
            ) {
                getClassesStatus.value?.let { apiResponse ->

                    if (apiResponse.success) {
                        val classes = apiResponse.data?.reversed()

                        if (!classes.isNullOrEmpty()) {
                            items(classes) { item ->

                                ClassItemCard(
                                    className = item.name ?: "",
                                    description = item.description ?: "",
                                    numberOfMembers = item.numberOfUsers ?: 0
                                ) {
                                    item.id?.let { id ->
                                        browseViewModel.submitRequest(id)
                                    }
                                }
                            }
                        } else {
                            item {
                                Text(
                                    text = "No classes found.",
                                    modifier = Modifier.padding(16.dp),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    } else {
                        item {
                            Text(
                                text = apiResponse.message
                                    ?: "Failed to load classes.",
                                modifier = Modifier.padding(16.dp),
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
        }

        // Add class dialog
        if (showAddClassDialog.value) {
            AddClassDialog(
                onDismissRequest = {
                    showAddClassDialog.value = false
                }
            ) { name, description ->

                if (name.isNotEmpty() && description.isNotEmpty()) {

                    browseViewModel.addClass(
                        name,
                        description
                    )

                    showAddClassDialog.value = false

                } else {
                    showToast(
                        context,
                        "Please add all the fields."
                    )
                }
            }
        }
    }
}

@Composable
fun ClassItemCard(
    className: String,
    description: String,
    numberOfMembers: Int,
    onItemClicked: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .background(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {

        Text(
            text = className,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium
        )

        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {

            Icon(
                painter = painterResource(
                    id = R.drawable.ic_person
                ),
                contentDescription = "Members",
                modifier = Modifier.size(24.dp)
            )

            Spacer(
                modifier = Modifier.width(4.dp)
            )

            Text(
                text = "$numberOfMembers",
                style = MaterialTheme.typography.displaySmall,
                fontSize = 12.sp
            )

            Spacer(
                modifier = Modifier.weight(1f)
            )

            IconButton(
                onClick = onItemClicked
            ) {
                Icon(
                    painter = painterResource(
                        id = R.drawable.ic_request
                    ),
                    contentDescription = "Request"
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewClassItemCard() {
    ClassItemCard(
        className = "Title",
        description = "Lorem Ipsum",
        numberOfMembers = 12
    ) {}
}
