import React from 'react'
import { ControlPackage } from './runtime-types'
import registry from '../../../packages/ui/src/registry.component-registry'

interface Props { control: ControlPackage }

export const ControlRenderer: React.FC<Props> = ({ control }) => {
  const typeKey = (control as any).control_type || (control as any).controlType || ''
  const def = registry.get(typeKey)
  if (!def) {
    return <div data-testid={`unknown-${(control as any).id}`}>Unknown: {typeKey}</div>
  }
  // base props from metadata
  const props = { ...((control as any).properties || {}) }
  // formulas not executed yet — expose no-op
  if ((control as any).formulas && (control as any).formulas.length > 0) {
    props['onFormula'] = () => null
  }
  // build child controls recursively and sort by z_index ascending
  const children = ((control as any).children || []).slice().sort((a: any, b: any) => (a.z_index || 0) - (b.z_index || 0))
  const childrenElements = children.map((ch: any) => <ControlRenderer control={ch} key={ch.id} />)
  if (childrenElements.length > 0) props['children'] = childrenElements

  return <>{def.renderRuntime(props)}</>
}

export default ControlRenderer
import { ControlPackage } from './runtime-types'
import registry from '../../../packages/ui/src/registry.component-registry'

interface Props { control: ControlPackage }

export const ControlRenderer: React.FC<Props> = ({ control }) => {
  const typeKey = (control as any).control_type || (control as any).controlType || ''
  const def = registry.get(typeKey)
  if (!def) {
    return <div data-testid={`unknown-${(control as any).id}`}>Unknown: {typeKey}</div>
  }
  // pass properties as props
  const props = { ...((control as any).properties || {}) }
  // wire basic events (formulas not executed yet)
  if ((control as any).formulas && (control as any).formulas.length > 0) {
    props['onFormula'] = () => null
  }
  return <>{def.renderRuntime(props)}</>
}

export default ControlRenderer
