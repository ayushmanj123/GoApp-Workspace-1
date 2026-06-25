package state

import "fmt"

func (s *sessionState) getVariable(name string) (any, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	value, ok := s.globalVariables[name]
	return cloneValue(value), ok
}

func (s *sessionState) setVariable(name string, value any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.globalVariables == nil {
		s.globalVariables = map[string]any{}
	}
	s.globalVariables[name] = cloneValue(value)
}

func (s *sessionState) updateVariable(name string, value any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.globalVariables == nil {
		return ErrVariableNotFound
	}
	if _, ok := s.globalVariables[name]; !ok {
		return ErrVariableNotFound
	}
	s.globalVariables[name] = cloneValue(value)
	return nil
}

func (s *sessionState) deleteVariable(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.globalVariables == nil {
		return ErrVariableNotFound
	}
	if _, ok := s.globalVariables[name]; !ok {
		return ErrVariableNotFound
	}
	delete(s.globalVariables, name)
	return nil
}

func (s *sessionState) snapshotVariables() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]any, len(s.globalVariables))
	for key, value := range s.globalVariables {
		out[key] = cloneValue(value)
	}
	return out
}

func cloneValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		copy := make(map[string]any, len(typed))
		for key, item := range typed {
			copy[key] = cloneValue(item)
		}
		return copy
	case []any:
		copy := make([]any, len(typed))
		for i, item := range typed {
			copy[i] = cloneValue(item)
		}
		return copy
	default:
		return value
	}
}

func validateName(name string) error {
	if name == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidRequest)
	}
	return nil
}
