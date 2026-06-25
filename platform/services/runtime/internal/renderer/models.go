package renderer

// Control is a metadata-driven control payload for clients.
type Control struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
}

// Screen is the evaluated render tree for one screen.
type Screen struct {
	Screen   string    `json:"screen"`
	Controls []Control `json:"controls"`
}
