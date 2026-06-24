// Runtime DTO types (mirror server JSON structure)
export interface RuntimeFormula {
  id: string
  control_id: string
  property_name: string
  formula_text: string
  formula_type: string
}

export interface RuntimeControl {
  id: string
  screen_id: string
  parent_control_id?: string | null
  control_type: string
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  z_index?: number
  properties?: Record<string, any>
  formulas?: RuntimeFormula[]
  children?: RuntimeControl[]
}

export interface RuntimeScreen {
  id: string
  application_id: string
  name?: string
  display_order?: number
  layout_type?: string
  on_visible?: string
  controls: RuntimeControl[]
}

export interface RuntimeApplication {
  id: string
  tenant_id?: string
  name?: string
  status?: string
  on_start?: string
  screens: RuntimeScreen[]
  entities?: RuntimeEntity[]
  created_on?: string
}

export interface RuntimeEntity {
  name: string
  fields: RuntimeEntityField[]
}

export interface RuntimeEntityField {
  name: string
  field_type: string
}

export type AppPackage = RuntimeApplication
export type ScreenPackage = RuntimeScreen
export type ControlPackage = RuntimeControl
