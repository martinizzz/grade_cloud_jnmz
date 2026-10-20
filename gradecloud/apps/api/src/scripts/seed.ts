import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { pool } from '../db.js'

try {
    const sql = await readFile(new URL('../../sql/seed.sql', import.meta.url), 'utf-8')
    await pool.query(sql)
    // pool.query devuelve las filas afectadas, y pool sirve para 
    // conectarse a la base de datos.
    console.log('Semilla aplicada correctamente')
} catch (error) {
    // Si hay un error, se muestra el error y se sale del programa.
    console.error('Error al aplicar la semilla:', error)
    process.exitCode = 1
} finally {
    // Se cierra la conexión a la base de datos.
    await pool.end()
}