// Clone-check fixture (tools/jscpd/README.md): unrelated to every other `_clean` file.
package fixtures.clean

@JvmInline
value class Celsius(val degrees: Double) {
    fun toFahrenheit(): Double = degrees * 9 / 5 + 32

    fun describe(): String = when {
        degrees < 0 -> "freezing"
        degrees < 15 -> "cold"
        degrees < 25 -> "mild"
        else -> "hot"
    }
}
