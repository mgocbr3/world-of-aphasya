package com.worldofaphasya

internal fun removeLegacyMwaAuthorizationToken(remove: () -> Boolean): Boolean =
    try {
        remove()
    } catch (_: Exception) {
        false
    }
