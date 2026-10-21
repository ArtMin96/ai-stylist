package app.aistylist.feature.capture.camera

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.domain.DeviceSample
import kotlin.math.acos
import kotlin.math.sqrt

/**
 * The phone's motion for the steady and tilt checks (capture brief §3): linear acceleration is the
 * accelerometer minus a low-pass gravity estimate (α from the rules), tilt the angle between gravity
 * and the phone's back axis (0° when held flat above the item, camera down). [latest] is null without
 * an accelerometer or before the first reading.
 */
class DeviceMotionSensor(
    context: Context,
) : SensorEventListener {
    private val manager = context.getSystemService(SensorManager::class.java)
    private val gravity = FloatArray(AXES)

    @Volatile
    var latest: DeviceSample? = null
        private set

    private var hasGravity = false

    fun start() {
        val accelerometer = manager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
        hasGravity = false
        manager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        manager?.unregisterListener(this)
        latest = null
    }

    override fun onSensorChanged(event: SensorEvent) {
        val alpha = CaptureRules.Android.GRAVITY_LOW_PASS_ALPHA.toFloat()
        for (axis in 0 until AXES) {
            gravity[axis] =
                if (hasGravity) alpha * gravity[axis] + (1 - alpha) * event.values[axis] else event.values[axis]
        }
        hasGravity = true
        var linearSquared = 0f
        for (axis in 0 until AXES) {
            val linear = event.values[axis] - gravity[axis]
            linearSquared += linear * linear
        }
        latest = DeviceSample(linearAccelerationMps2 = sqrt(linearSquared).toDouble(), tiltDegrees = tiltDegrees())
    }

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int,
    ) = Unit

    /** The accelerometer reads +g on z when the phone lies screen up, i.e. its back axis points down. */
    private fun tiltDegrees(): Double {
        val norm = sqrt(gravity[0] * gravity[0] + gravity[1] * gravity[1] + gravity[2] * gravity[2])
        if (norm == 0f) return 0.0
        return Math.toDegrees(acos((gravity[2] / norm).coerceIn(-1f, 1f).toDouble()))
    }

    private companion object {
        const val AXES = 3
    }
}
