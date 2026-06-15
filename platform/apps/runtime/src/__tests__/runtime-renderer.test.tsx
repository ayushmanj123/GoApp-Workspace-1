import React from 'react'
import { render, screen } from '@testing-library/react'
import { RuntimeProvider } from '../runtime-provider'
import RuntimeRenderer from '../runtime-renderer'
import registerRuntime from '../registry-bridge'

describe('Runtime rendering - hierarchy', () => {
  beforeAll(() => { registerRuntime() })
  it('renders nested container hierarchy', async () => {
    const fakePkg = {
      id: 'app1', tenant_id: 't1', name: 'App1', status: 'draft',
      screens: [{
        id: 's1', application_id: 'app1', name: 'Screen1', display_order: 1, layout_type: 'grid',
        controls: [
          {
            id: 'c_root', screen_id: 's1', control_type: 'Container', name: 'Root', z_index: 0, properties: { direction: 'column' },
            children: [
              { id: 'c_label', screen_id: 's1', control_type: 'Label', name: 'Label1', z_index: 0, properties: { text: 'Label1' }, children: [] },
              { id: 'c_button', screen_id: 's1', control_type: 'Button', name: 'Btn1', z_index: 1, properties: { text: 'ClickMe' }, children: [] },
              {
                id: 'c_inner', screen_id: 's1', control_type: 'Container', name: 'Inner', z_index: 2, properties: { direction: 'row' },
                children: [
                  { id: 'c_input', screen_id: 's1', control_type: 'TextInput', name: 'Input1', z_index: 0, properties: { value: 'InputValue' }, children: [] }
                ]
              }
            ]
          }
        ]
      }],
      created_on: new Date()
    }
    const original = global.fetch
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ data: fakePkg }) }))
    render(<RuntimeProvider appId={'app1'}><RuntimeRenderer /></RuntimeProvider>)
    // await elements
    expect(await screen.findByText('Label1')).toBeDefined()
    expect(await screen.findByText('ClickMe')).toBeDefined()
    expect(await screen.findByDisplayValue('InputValue')).toBeDefined()
    // cleanup
    // @ts-ignore
    global.fetch = original
  })
})
import { render, screen } from '@testing-library/react'
import { RuntimeProvider } from '../runtime-provider'
import RuntimeRenderer from '../runtime-renderer'
import registerRuntime from '../registry-bridge'

// NOTE: test runner not configured here; these tests assume typical React Testing Library.

describe('Runtime rendering', () => {
  beforeAll(() => { registerRuntime() })
  it('renders loading then screen', async () => {
    // mount provider with fake fetch by mocking global.fetch
    const fakePkg = { id: 'app1', tenant_id: 't1', name: 'App1', status: 'draft', screens: [{ id: 's1', application_id: 'app1', name: 'Screen1', display_order: 1, layout_type: 'grid', controls: [{ id: 'c1', screen_id: 's1', control_type: 'Button', name: 'Btn1', x:0,y:0,width:10,height:10,z_index:1, properties: { text: 'Click' }, formulas: [] }]}], created_on: new Date() }
    const original = global.fetch
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ data: fakePkg }) }))
    render(<RuntimeProvider appId={'app1'}><RuntimeRenderer /></RuntimeProvider>)
    expect(screen.getByText(/Loading/i)).toBeDefined()
    // cleanup
    // @ts-ignore
    global.fetch = original
  })
})
