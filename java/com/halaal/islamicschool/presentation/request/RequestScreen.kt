package com.halaal.islamicschool.presentation.request

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.halaal.islamicschool.showToast
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Composable
fun RequestScreen(
    requestViewModel: RequestViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    val outputFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd hh:mm a")

    val getRequestsStatus = requestViewModel.getRequestsStatus.collectAsState()
    val lazyListState = rememberLazyListState()

    Column(
        modifier = Modifier.fillMaxSize()
    ) {

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(
                onClick = {
                    coroutineScope.launch {
                        requestViewModel.refresh()
                    }
                }
            ) {
                Text("Refresh")
            }
        }

        LazyColumn(
            state = lazyListState,
            modifier = Modifier.fillMaxSize()
        ) {
            getRequestsStatus.value?.let { apiResponse ->
                if (apiResponse.success) {
                    val requests = apiResponse.data?.reversed()

                    if (!requests.isNullOrEmpty()) {
                        items(requests) { item ->

                            val localDateTime = try {
                                LocalDateTime.parse(
                                    item.timestamp,
                                    formatter
                                ).format(outputFormatter)
                            } catch (e: Exception) {
                                item.timestamp
                            }

                            RequestItemCard(
                                className = item.requestedClass?.name ?: "Unknown Class",
                                timestamp = "Requested At: $localDateTime",
                                status = item.status ?: "PENDING"
                            )
                        }
                    }
                } else {
                    item {
                        Text(
                            text = apiResponse.message,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RequestItemCard(
    className: String,
    timestamp: String,
    status: String
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
            text = timestamp,
            style = MaterialTheme.typography.bodyMedium
        )

        Text(
            text = status,
            style = MaterialTheme.typography.bodyMedium,
            color = when (status) {
                "DECLINED" -> Color.Red
                "APPROVED" -> Color.Green
                else -> Color.Yellow
            }
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewCardItem() {
    RequestItemCard(
        className = "Title",
        timestamp = "2024-04-24 01:22 PM",
        status = "APPROVED"
    )
}
