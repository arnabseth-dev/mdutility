import React from 'react';

interface UpdateModalProps {
    isOpen: boolean;
    onUpdate: () => void;
    onClose: () => void;
    isLoading?: boolean;
}

export default function UpdateModal({ isOpen, onUpdate, onClose, isLoading }: UpdateModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#0b2a4b] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white">New Update Available</h3>
                    </div>

                    <p className="text-gray-300 mb-6 leading-relaxed">
                        A new version of the application has been detected.
                        <br />
                        <span className="text-sm text-gray-400 mt-2 block">
                            We recommend updating now to get the latest features and fixes.
                            <strong> Your current form data and state will be preserved.</strong>
                        </span>
                    </p>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                        >
                            Update Later
                        </button>
                        <button
                            onClick={onUpdate}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all text-sm font-medium flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Updating...
                                </>
                            ) : (
                                'Update Now'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
