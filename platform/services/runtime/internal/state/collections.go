package state

func (s *sessionState) getCollection(name string) []any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneItems(s.collections[name])
}

func (s *sessionState) setCollection(name string, items []any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.collections == nil {
		s.collections = map[string][]any{}
	}
	s.collections[name] = cloneItems(items)
}

func (s *sessionState) clearCollection(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.collections == nil {
		s.collections = map[string][]any{}
	}
	s.collections[name] = []any{}
}

func (s *sessionState) collect(name string, item any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.collections == nil {
		s.collections = map[string][]any{}
	}
	s.collections[name] = append(s.collections[name], cloneValue(item))
}

func (s *sessionState) clear(name string) {
	s.clearCollection(name)
}

func (s *sessionState) clearCollect(name string, items []any) {
	s.setCollection(name, items)
}

func (s *sessionState) first(name string) (any, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := s.collections[name]
	if len(items) == 0 {
		return nil, false
	}
	return cloneValue(items[0]), true
}

func (s *sessionState) last(name string) (any, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := s.collections[name]
	if len(items) == 0 {
		return nil, false
	}
	return cloneValue(items[len(items)-1]), true
}

func (s *sessionState) countRows(name string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.collections[name])
}

func (s *sessionState) snapshotCollections() map[string][]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string][]any, len(s.collections))
	for key, items := range s.collections {
		out[key] = cloneItems(items)
	}
	return out
}

func cloneItems(items []any) []any {
	if items == nil {
		return []any{}
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = cloneValue(item)
	}
	return out
}
