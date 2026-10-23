import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js'

export const routes = Router();


const studentSchema = z.object({
    full_name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(100)
})

const courseSchema = z.object({
    code: z.string().trim().toLowerCase().min(2).max(20),
    title: z.string().trim().min(3).max(120)
})

const gradeSchema = z.object({
    student_id: z.number().int().positive(),
    course_id: z.number().int().positive(),
    score: z.number().min(0).max(100)
})

function invalidResponse(issues: z.ZodIssue[]) {
    return {
        error: {
            message: 'Datos Invalidos',
            details: issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message
            }))
        }
    }
}

routes.get('/students', async (_req, res) => {
    const { rows } = await pool.query('SELECT id, full_name, email FROM students ORDER BY id DESC')
    res.json({
        data: rows
    })
})

routes.post('/students', async (req, res) => {
    const parsed = studentSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json(invalidResponse(parsed.error.issues))
        return
    }
    const { full_name, email } = parsed.data
    const { rows } = await pool.query('INSERT INTO students (full_name, email) VALUES ($1, $2) RETURNING id, full_name, email', [full_name, email])
    res.status(201).json({
        data: rows[0]
    })
})

routes.get('/courses', async (_req, res) => {
    const { rows } = await pool.query('SELECT id, code, title FROM courses ORDER BY id DESC')
    res.json({
        data: rows
    })
})

routes.post('/courses', async (req, res) => {
    const parsed = courseSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json(invalidResponse(parsed.error.issues))
        return
    }
    const { code, title } = parsed.data
    const { rows } = await pool.query('INSERT INTO courses (code, title) VALUES ($1, $2) RETURNING id, code, title', [code, title])
    res.status(201).json({
        data: rows[0]
    })
})

routes.get('/grades', async (_req, res) => {
    const { rows } = await pool.query(`
    SELECT g.id, s.id as student_id, s.full_name as student_name, c.id as course_id, c.title as course_title, g.score
    FROM grades g
    INNER JOIN students s ON s.id = g.student_id
    INNER JOIN courses c ON c.id = g.course_id
    ORDER BY g.id DESC
    `)
    res.json({
        data: rows
    })
})

routes.post('/grades', async (req, res) => {
    const parsed = gradeSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json(invalidResponse(parsed.error.issues))
        return
    }
    const { student_id, course_id, score } = parsed.data
    const { rows } = await pool.query(`
        INSERT INTO grades (student_id, course_id, score) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (student_id, course_id) 
        DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
        RETURNING id, student_id, course_id, score
        ` , [student_id, course_id, score])
    res.status(201).json({
        data: rows[0]
    })
})

routes.delete('/grades/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({
            error: {
                message: 'El ID debe ser un número entero positivo'
            }
        })
        return
    }
    const result = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING id', [id])
    if (result.rowCount === 0) {
        res.status(404).json({
            error: {
                message: 'La calificación no existe'
            }
        })
        return
    }
    res.status(200).send()
})

routes.get('/summary', async (_req, res) => {

    const [totals, byCourse] = await Promise.all([
        pool.query(`SELECT (SELECT COUNT(*):: INT FROM students) AS students,
        (SELECT COUNT(*):: INT FROM courses) AS courses,
        (SELECT COUNT(*):: INT FROM grades) AS grades,
        (SELECT ROUND(AVG(score), 2):: float FROM grades) AS average_score
        `),
        pool.query(`
        SELECT c.id, c.code, c.title, COUNT(g.id) as grade_count, 
        (ROUND(AVG(g.score), 2):: float) AS average_score
        FROM courses c
        LEFT JOIN grades g ON g.course_id = c.id
        GROUP BY c.id, c.code, c.title
        ORDER BY c.id DESC
        `)
    ])

    res.json({
        data: {
            ...totals.rows[0],
            by_course: byCourse.rows
        }
    })
})