import { describe, it, expect } from 'vitest'
import { extractField, extractList } from './parser'

describe('extractField', () => {
  it('extrae un campo con negritas', () => {
    expect(extractField('**Nombre:** Aldric', 'Nombre')).toBe('Aldric')
  })

  it('extrae un campo simple', () => {
    expect(extractField('Título: La taberna del dragón', 'Título')).toBe('La taberna del dragón')
  })

  it('devuelve null si no existe', () => {
    expect(extractField('sin campos', 'Nombre')).toBeNull()
  })
})

describe('extractList', () => {
  it('separa valores por saltos de línea', () => {
    const text = '**Rasgos:**\n- Valiente\n- Leal\n'
    expect(extractList(text, 'Rasgos')).toEqual(['Valiente', 'Leal'])
  })

  it('separa valores separados por comas en una línea', () => {
    const text = '**Rasgos:** Valiente, Leal, Curioso'
    expect(extractList(text, 'Rasgos')).toEqual(['Valiente', 'Leal', 'Curioso'])
  })

  it('separa valores con comas y espacios', () => {
    const text = 'Equipo: espada,  escudo , poción'
    expect(extractList(text, 'Equipo')).toEqual(['espada', 'escudo', 'poción'])
  })

  it('mezcla líneas y comas', () => {
    const text = '**Objetivos:**\n- Rescatar al aldeano, encontrar la cueva\n- Derrotar al dragón'
    expect(extractList(text, 'Objetivos')).toEqual(['Rescatar al aldeano', 'encontrar la cueva', 'Derrotar al dragón'])
  })
})
