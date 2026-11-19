
package com.halaal.islamicschool.presentation.userclasses

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.navigation.NavController
import com.halaal.islamicschool.R
import kotlinx.coroutines.launch

@Composable
fun UserClassesScreen(
    navController: NavController,
    userClassesViewModel: UserClassesViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val getClassesStatus =
        userClassesViewModel.getUserClassesStatus.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize()
    ) {

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(
                onClick = {
                    coroutineScope.launch {
                        userClassesViewModel.refresh()
                    }
                }
            ) {
                Text(text = "Refresh")
            }
        }

        LazyColumn(
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
                                navController.navigate(
                                    "ClassDetails/${item.id}/${item.name}"
                                )
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
            .clickable {
                onItemClicked()
            }
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
                painter = painterResource(id = R.drawable.ic_person),
                contentDescription = "Members",
                modifier = Modifier.size(24.dp)
            )

            Spacer(modifier = Modifier.width(4.dp))

            Text(
                text = "$numberOfMembers",
                style = MaterialTheme.typography.displaySmall,
                fontSize = 12.sp
            )
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
    ) {
    }
}
