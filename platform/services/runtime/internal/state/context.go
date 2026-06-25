package state

import "fmt"

func (s *sessionState) getContext(screen, name string) (any, bool) {
	if err := validateScreen(screen); err != nil {
		return nil, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	screenVars, ok := s.contextVariables[screen]
	if !ok {
		return nil, false
	}
	value, ok := screenVars[name]
	return cloneValue(value), ok
}

func (s *sessionState) setContext(screen, name string, value any) {
	if err := validateScreen(screen); err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.contextVariables == nil {
		s.contextVariables = map[string]map[string]any{}
	}
	if s.contextVariables[screen] == nil {
		s.contextVariables[screen] = map[string]any{}
	}
	s.contextVariables[screen][name] = cloneValue(value)
}

func (s *sessionState) updateContext(screen string, values map[string]any) {
	if err := validateScreen(screen); err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.contextVariables == nil {
		s.contextVariables = map[string]map[string]any{}
	}
	if s.contextVariables[screen] == nil {
		s.contextVariables[screen] = map[string]any{}
	}
	for key, value := range values {
		s.contextVariables[screen][key] = cloneValue(value)
	}
}

func (s *sessionState) snapshotContext() map[string]map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]map[string]any, len(s.contextVariables))
	for screen, values := range s.contextVariables {
		copyScreen := make(map[string]any, len(values))
		for key, value := range values {
			copyScreen[key] = cloneValue(value)
		}
		out[screen] = copyScreen
	}
	return out
}

func validateScreen(screen string) error {
	if screen == "" {
		return fmt.Errorf("%w: screen is required", ErrInvalidRequest)
	}
	return nil
}
