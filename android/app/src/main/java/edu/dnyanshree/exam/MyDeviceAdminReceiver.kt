package edu.dnyanshree.exam

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class MyDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Toast.makeText(context, "Proctor Device Admin Enabled: Anti-cheat active", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Toast.makeText(context, "Proctor Device Admin Disabled: Anti-cheat inactive", Toast.LENGTH_SHORT).show()
    }
}
