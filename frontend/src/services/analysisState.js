export const initialAnalysisState = {
  data: null,
  selectedRouteId: null,
  error: "",
  loading: false,
  requestId: 0,
};

export function beginAnalysis(state, requestId) {
  return {
    ...state,
    data: null,
    selectedRouteId: null,
    error: "",
    loading: true,
    requestId,
  };
}

export function completeAnalysis(state, requestId, data) {
  if (requestId !== state.requestId) {
    return state;
  }

  return {
    ...state,
    data,
    selectedRouteId: data.recommended_route_id || data.routes[0]?.id || null,
    loading: false,
    error: "",
  };
}

export function failAnalysis(state, requestId, error) {
  if (requestId !== state.requestId) {
    return state;
  }

  return {
    ...state,
    data: null,
    selectedRouteId: null,
    loading: false,
    error,
  };
}
