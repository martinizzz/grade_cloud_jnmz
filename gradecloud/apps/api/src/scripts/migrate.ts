import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { pool } from '../db.js'

try {
    const sql = await readFile(new URL('../../sql/schema.sql', import.meta.url), 'utf-8')
    await pool.query(sql)
    // pool.query devuelve las filas afectadas, y pool sirve para 
    // conectarse a la base de datos.
    console.log('Migración aplicada correctamente')
} catch (error) {
    // Si hay un error, se muestra el error y se sale del programa.
    console.error('Error al migrar la base de datos:', error)
    process.exitCode = 1
} finally {
    // Se cierra la conexión a la base de datos.
    await pool.end()
}