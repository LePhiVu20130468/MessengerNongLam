
import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import './App.css';
import { useWebSocket } from './useWebSocket';
import { ChatMessage, User } from './types';

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};

const formatDateTime = (timeString?: string) => {
    let dateToFormat = timeString ? timeString : new Date().toISOString();
    try {
        let date: Date;
        if (dateToFormat.includes(' ') && !dateToFormat.includes('T')) {
            const isoServer = dateToFormat.replace(' ', 'T') + 'Z';
            date = new Date(isoServer);
        } else {
            date = new Date(dateToFormat);
        }
        if (isNaN(date.getTime())) return "";
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${hours}:${minutes} ${day}-${month}-${year}`;
    } catch (e) {
        return "";
    }
};

const playNotificationSound = () => {
    const audio = new Audio("/mess.mp3");
    audio.volume = 0.5;
    audio.play().catch(e => console.error("Không thể phát âm thanh:", e));
};

const CustomAlert = ({ message, onClose, btnText = "Nhập thông tin đăng nhập" }: { message: string, onClose: () => void, btnText?: string }) => {
    if (!message) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000
        }}>
            <div style={{
                backgroundColor: 'white', padding: '20px', borderRadius: '10px',
                width: '90%', maxWidth: '400px', textAlign: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '10px', right: '10px',
                        background: 'transparent', border: 'none', fontSize: '1.2em', cursor: 'pointer', color: '#555'
                    }}
                >✕</button>

                <h3 style={{ color: 'green', marginTop: '10px', marginBottom: '15px' }}>Thông báo</h3>
                <p style={{ color: '#333', fontSize: '1em', marginBottom: '25px' }}>{message}</p>

                <button
                    onClick={onClose}
                    style={{
                        backgroundColor: 'green', color: 'white', border: 'none',
                        padding: '10px 20px', borderRadius: '5px', fontSize: '1em', cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    {btnText}
                </button>
            </div>
        </div>
    );
};

const SuccessDialog = ({ show, message }: { show: boolean, message: string }) => {
    if (!show) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001
        }}>
            <style>
                {`
                    @keyframes spin-border {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loading-circle {
                        position: absolute; top: -5px; left: -5px; right: -5px; bottom: -5px;
                        border-radius: 50%;
                        border: 3px solid transparent;
                        border-top-color: red; 
                        animation: spin-border 0.3s linear infinite;
                    }
                `}
            </style>
            <div style={{
                backgroundColor: 'white', padding: '30px', borderRadius: '15px',
                width: '90%', maxWidth: '350px', textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)', position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '20px' }}>
                    <div className="loading-circle"></div>
                    <img
                        src={process.env.PUBLIC_URL + "/favicon.svg"}
                        alt="Logo"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                    />
                </div>

                <h3 style={{ color: message.includes('thành công') ? '#0b5c15' : 'red', margin: '0', fontSize: '1.2em' }}>
                    {message}
                </h3>
            </div>
        </div>
    );
};

interface AuthFormProps {
    mode: 'login' | 'register';
    username: string; setUsername: (s: string) => void;
    password: string; setPassword: (s: string) => void;
    fullname: string; setFullname: (s: string) => void;
    confirmPass: string; setConfirmPass: (s: string) => void;
    handleLogin: () => void;
    handleRegister: () => void;
    isConnected: boolean;
    setErrorMessage: (msg: string) => void;
    setDialogBtnText: (text: string) => void;
}

const AuthForm = ({ mode, username, setUsername, password, setPassword, fullname, setFullname, confirmPass, setConfirmPass, handleLogin, handleRegister, isConnected, setErrorMessage, setDialogBtnText }: AuthFormProps) => {
    const navigate = useNavigate();
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    const onActionClick = () => {
        if (mode === 'login') {
            if (!username || !password) {
                setDialogBtnText("Nhập thông tin đăng nhập");
                setErrorMessage("Bạn chưa nhập thông tin Tên đăng nhập hoặc Mật khẩu");
                return;
            }
            handleLogin();
        } else {
            if (!username || !password || !confirmPass) {
                setDialogBtnText("Nhập thông tin");
                setErrorMessage("Bạn chưa nhập đầy đủ thông tin để đăng ký");
                return;
            }
            if (password !== confirmPass) {
                setDialogBtnText("Nhập thông tin lại");
                setErrorMessage("Mật khẩu nhập lại không khớp");
                return;
            }
            handleRegister();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onActionClick();
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', backgroundColor: '#fff', padding: '20px', boxSizing: 'border-box' }}>
            <style>
                {`
                    .animated-box { position: relative; overflow: hidden; background: white; }
                    .border-line { position: absolute; display: block; pointer-events: none; }
                    .border-line:nth-child(1) { top: 0; left: -100%; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, green); animation: btn-anim1 4s linear infinite; }
                    .border-line:nth-child(2) { top: -100%; right: 0; width: 2px; height: 100%; background: linear-gradient(180deg, transparent, green); animation: btn-anim2 4s linear infinite; animation-delay: 1s; }
                    .border-line:nth-child(3) { bottom: 0; right: -100%; width: 100%; height: 2px; background: linear-gradient(270deg, transparent, green); animation: btn-anim3 4s linear infinite; animation-delay: 2s; }
                    .border-line:nth-child(4) { bottom: -100%; left: 0; width: 2px; height: 100%; background: linear-gradient(360deg, transparent, green); animation: btn-anim4 4s linear infinite; animation-delay: 3s; }
                    @keyframes btn-anim1 { 0% { left: -100%; } 50%,100% { left: 100%; } }
                    @keyframes btn-anim2 { 0% { top: -100%; } 50%,100% { top: 100%; } }
                    @keyframes btn-anim3 { 0% { right: -100%; } 50%,100% { right: 100%; } }
                    @keyframes btn-anim4 { 0% { bottom: -100%; } 50%,100% { bottom: 100%; } }
                    .input-group { position: relative; width: 100%; }
                    .eye-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #888; font-size: 1.2em; user-select: none; }
                `}
            </style>
            <div className="animated-box" style={{ border: '1px solid #f0f0f0', padding: '0px 40px 40px', borderRadius: '5px', textAlign: 'center', width: '100%', maxWidth: '400px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <span className="border-line"></span><span className="border-line"></span><span className="border-line"></span><span className="border-line"></span>
                <img src={process.env.PUBLIC_URL + "/logo70.png"} alt="Logo NLU" style={{ width: '60%', maxWidth: '290px', height: 'auto', marginBottom: '0px', objectFit: 'contain' }} />
                <h1 style={{ color: 'green', margin: '0', textTransform: 'uppercase', letterSpacing: '0px', fontSize: '1.5rem' }}>{mode === 'login' ? 'ĐĂNG NHẬP TÀI KHOẢN' : 'ĐĂNG KÝ TÀI KHOẢN'}</h1>
                <h1 style={{ color: 'green', margin: '0 0 30px 0', fontSize: '1.8rem' }}>"MESSENGER NÔNG LÂM"</h1>
                {!isConnected && <div style={{color: 'red', marginBottom: 15, fontSize: '0.9em'}}>⚠️ Mất kết nối server...</div>}

                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <input placeholder="Tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown} autoFocus style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '16px', width: '100%', boxSizing: 'border-box' }} />

                    <div className="input-group">
                        <input type={showPass ? "text" : "password"} placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '16px', width: '100%', boxSizing: 'border-box', paddingRight: '40px' }} />
                        <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                    </div>

                    {mode === 'register' && (
                        <div className="input-group">
                            <input type={showConfirmPass ? "text" : "password"} placeholder="Nhập lại mật khẩu" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '16px', width: '100%', boxSizing: 'border-box', paddingRight: '40px' }} />
                            <span className="eye-icon" onClick={() => setShowConfirmPass(!showConfirmPass)}>{showConfirmPass ? '🙈' : '👁️'}</span>
                        </div>
                    )}
                </div>

                <div style={{marginTop: 25}}>
                    <button onClick={onActionClick} disabled={!isConnected} style={{ width: '100%', padding: '12px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
                </div>
                <div style={{marginTop: 20, fontSize: '0.9em', color: '#555'}}>
                    {mode === 'login' ? <span>Chưa có tài khoản? <span style={{color:'green', cursor:'pointer', fontWeight:'bold', textDecoration:'underline'}} onClick={() => navigate('/register')}>Đăng ký tại đây</span></span> : <span>Đã có tài khoản? <span style={{color:'green', cursor:'pointer', fontWeight:'bold', textDecoration:'underline'}} onClick={() => navigate('/login')}>Đăng nhập tại đây</span></span>}
                </div>
            </div>
        </div>
    );
};

const RequireAuth = ({ children, isLoggedIn }: { children: React.ReactNode, isLoggedIn: boolean }) => {
    const location = useLocation();
    if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
    return <>{children}</>;
};

const VideoCallInterface = ({ localStream, remoteStream, onEndCall }: { localStream: MediaStream | null, remoteStream: MediaStream | null, onEndCall: () => void }) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }, [localStream]);
    useEffect(() => { if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: '100px', right: '20px', width: '120px', height: '160px', background: '#333', borderRadius: '10px', overflow: 'hidden', border: '2px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                {!remoteStream && <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'white', background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: '20px'}}>Đang kết nối...</div>}
            </div>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
                <button onClick={onEndCall} style={{ padding: '15px 30px', borderRadius: '30px', border: 'none', background: 'red', color: 'white', fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer' }}>KẾT THÚC</button>
            </div>
        </div>
    );
};

interface ChatInterfaceProps {
    isConnected: boolean; currentUser: string; handleLogout: () => void; searchUserQuery: string; setSearchUserQuery: (s: string) => void; handleCheckUserExist: () => void; handleCreateRoom: () => void; handleJoinRoom: () => void; myChatList: User[]; currentChatTarget: User | null; isTargetOnline: boolean | null; chatHistory: ChatMessage[]; messageInput: string; setMessageInput: (s: string) => void; handleSendChat: () => void; isSidebarOpen: boolean; setIsSidebarOpen: (b: boolean) => void; myChatListRef: React.MutableRefObject<User[]>; currentChatTargetRef: React.MutableRefObject<User | null>; setCurrentChatTarget: (u: User | null) => void; loadChatData: (u: User) => void; addToMyChatList: (u: User) => void;
    handleVideoCall: () => void; isInCall: boolean; localStream: MediaStream | null; remoteStream: MediaStream | null; endCall: () => void;
    userFullName: string;
}

const ChatInterface = (props: ChatInterfaceProps) => {
    const { name: routeChatName } = useParams();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [props.chatHistory]);

    useEffect(() => {
        if (routeChatName) {
            const realTargetName = routeChatName === 'me' ? props.currentUser : routeChatName;
            const foundUser = props.myChatListRef.current.find(u => u.name === realTargetName);
            const targetType = foundUser?.type ?? 0;
            const newTarget = { name: realTargetName, type: targetType };
            if (props.currentChatTargetRef.current?.name !== realTargetName) {
                props.setCurrentChatTarget(newTarget);
                props.loadChatData(newTarget);
                props.addToMyChatList(newTarget);
                if (isMobile) props.setIsSidebarOpen(false);
            }
        } else {
            props.setCurrentChatTarget(null);
            if (isMobile) props.setIsSidebarOpen(true);
        }
    }, [routeChatName, props.myChatList, isMobile, props.currentUser]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                return;
            }
            e.preventDefault();
            props.handleSendChat();
        }
    };

    return (
        <div className="app-container" style={{display: 'flex', height: '100vh', flexDirection: 'column', overflow: 'hidden'}}>
            {props.isInCall && <VideoCallInterface localStream={props.localStream} remoteStream={props.remoteStream} onEndCall={props.endCall} />}
            {!props.isConnected && <div style={{background: '#ff4d4f', color: 'white', padding: '5px', textAlign: 'center', fontSize: '0.9em'}}>⚠️ Mất kết nối máy chủ. Đang tự động kết nối lại...</div>}

            <div style={{display: 'flex', flex: 1, overflow: 'hidden', position: 'relative'}}>
                <div className="sidebar" style={{ width: props.isSidebarOpen ? (isMobile ? '100%' : '300px') : '0px', overflow: 'hidden', transition: 'width 0.3s ease', borderRight: props.isSidebarOpen ? '1px solid #ccc' : 'none', padding: props.isSidebarOpen ? 10 : 0, display: 'flex', flexDirection: 'column', background: '#fff', zIndex: 10 }}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src={process.env.PUBLIC_URL + "/logo70.png"} alt="Logo NLU" style={{ width: '200px', height: 'auto', objectFit: 'contain' }} />
                        {isMobile && <button onClick={() => props.setIsSidebarOpen(false)} style={{ position: 'absolute', right: 0, top: 0, background: 'transparent', border: 'none', fontSize: '24px', padding: '10px' }}>✕</button>}
                        {!isMobile && <button onClick={() => props.setIsSidebarOpen(false)} style={{ position: 'absolute', right: 0, top: 0, background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#555' }} title="Đóng menu">☰</button>}
                    </div>

                    {props.userFullName && (
                        <div style={{textAlign: 'center', padding: '5px 0'}}>
                            <h2 style={{color: 'red', margin: '5px 0', fontSize: '1.2rem', textTransform: 'uppercase'}}>{props.userFullName}</h2>
                        </div>
                    )}

                    <h3>Chào user <span style={{ color: 'red', fontWeight: 'bold' }}>{props.currentUser}</span> nhó!!!</h3>
                    <button onClick={props.handleLogout}>Đăng Xuất</button>

                    <hr style={{width:'100%'}}/>
                    <div className="search-box" style={{marginBottom: 10}}>
                        <small>Tìm kiếm:</small>
                        <div style={{display:'flex', marginTop: 5}}>
                            <input style={{flex:1, padding: 5, width: '100%'}} placeholder="Nhập username..." value={props.searchUserQuery} onChange={e => props.setSearchUserQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && props.handleCheckUserExist()} />
                            <button onClick={props.handleCheckUserExist} style={{marginLeft: 5}}>Chat ngay</button>
                        </div>
                    </div>
                    <hr style={{width:'100%'}}/>
                    <div style={{display:'flex', gap: 5}}>
                        <button style={{flex:1}} onClick={props.handleCreateRoom}>+ Tạo Room</button>
                        <button style={{flex:1}} onClick={() => props.handleJoinRoom()}>&rarr; Join</button>
                    </div>
                    <div className="user-list" style={{flex:1, overflowY:'auto', marginTop: 10}}>
                        <h4>Đoạn chat của bạn</h4>
                        {props.myChatList.map((item, index) => {
                            const isMe = item.name === props.currentUser;
                            const targetLink = isMe ? '/chat/me' : `/chat/${item.name}`;
                            const isSelected = (routeChatName === 'me' && isMe) || (routeChatName === item.name);
                            return (
                                <div key={index} onClick={() => navigate(targetLink)} style={{ padding: '10px', cursor: 'pointer', background: isSelected ? '#eee' : 'white', borderBottom: '1px solid #f0f0f0' }}>
                                    {item.type === 1 ? '🏠' : (isMe ? '📂' : '👤')} {isMe ? "My Documents" : item.name}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="chat-window" style={{flex: 1, display: (isMobile && props.isSidebarOpen) ? 'none' : 'flex', flexDirection: 'column', width: '100%'}}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa', position: 'relative', justifyContent: 'space-between', minHeight: '60px' }}>
                        {!props.isSidebarOpen && <button onClick={() => props.setIsSidebarOpen(true)} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', zIndex: 100 }} title="Mở menu">☰</button>}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingLeft: isMobile ? '45px' : '0' }}>
                            <img src={process.env.PUBLIC_URL + "/favicon.svg"} alt="Logo NLU" style={{ height: isMobile ? '45px' : '100px', width: 'auto', objectFit: 'contain' }} />
                        </div>
                        <div style={{ flex: 2, textAlign: 'center', padding: '0 5px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            {!isMobile && <h1 style={{ color: 'green', fontWeight: 'bold', margin: '0', fontSize: '1.5em' }}>TRƯỜNG ĐẠI HỌC NÔNG LÂM TP.HCM</h1>}
                            {!isMobile && <h1 style={{ color: 'green', fontWeight: 'bold', margin: '0', fontSize: '1.5em' }}>KHOA CÔNG NGHỆ THÔNG TIN</h1>}
                            <h3 style={{ color: '#d35400', margin: isMobile ? '0' : '5px 0 0 0', fontSize: isMobile ? '1rem' : '1.2em', fontWeight: 'bold', whiteSpace: 'nowrap' }}>MESSENGER NÔNG LÂM</h3>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingRight: isMobile ? '5px' : '0' }}>
                            <img src={process.env.PUBLIC_URL + "/fit.png"} alt="Logo Khoa CNTT" style={{ height: isMobile ? '45px' : '120px', width: 'auto', objectFit: 'contain' }} />
                        </div>
                    </div>

                    {props.currentChatTarget ? (
                        <>
                            <div className="chat-header" style={{padding: 10, borderBottom: '1px solid #ccc', fontWeight: 'bold', display:'flex', alignItems:'center'}}>
                                <span style={{flex: 1}}>{props.currentChatTarget.name === props.currentUser ? "My Documents (Cloud của tui)" : props.currentChatTarget.name}</span>
                                {props.currentChatTarget.type !== 1 && <span style={{fontSize: '0.8em', color: props.isTargetOnline ? 'green' : 'gray'}}>{props.isTargetOnline === true ? '🟢 Online' : props.isTargetOnline === false ? '⚪ Offline' : ''}</span>}
                            </div>
                            <div className="messages" style={{flex: 1, padding: 20, overflowY: 'auto'}}>
                                {props.chatHistory.map((msg, idx) => {
                                    const isMyMessage = msg.name === props.currentUser;
                                    return (
                                        <div key={idx} style={{textAlign: isMyMessage ? 'right' : 'left', margin: '5px 0'}}>
                                            <div style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, background: isMyMessage ? '#0084ff' : '#e4e6eb', color: isMyMessage ? 'white' : 'black', maxWidth: '80%', wordBreak: 'break-word', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                                                <small style={{display:'block', fontSize: '0.7em', opacity: 0.8, marginBottom: 4, minHeight: '1.2em'}}>{isMyMessage ? formatDateTime(msg.createAt) : `${msg.name} - ${formatDateTime(msg.createAt)}`}</small>
                                                {msg.mes}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                            <div className="input-area" style={{padding: 20, borderTop: '1px solid #ccc', display: 'flex', alignItems: 'center'}}>
                                <button onClick={props.handleVideoCall} style={{marginRight: 10, padding: '10px 15px', borderRadius: '50%', background: '#eee', border: 'none', cursor: 'pointer', fontSize: '1.2em'}} title="Video Call" disabled={!props.isConnected}>📹</button>

                                <textarea
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ccc',
                                        outline: 'none', resize: 'none', height: 'auto', minHeight: '40px', fontFamily: 'inherit'
                                    }}
                                    value={props.messageInput}
                                    onChange={e => props.setMessageInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter để xuống dòng)"
                                    disabled={!props.isConnected}
                                />

                                <button onClick={props.handleSendChat} style={{padding: '10px 20px', marginLeft: 10}} disabled={!props.isConnected}>Gửi</button>
                            </div>
                        </>
                    ) : (
                        <div style={{margin: 'auto', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Chọn một người hoặc phòng để bắt đầu chat</div>
                    )}
                    {!isMobile && <div style={{ padding: '10px', borderTop: '1px solid #eee', textAlign: 'center', backgroundColor: '#f8f9fa' }}><h3 style={{ margin: '5px 0', color: '#7f8c8d', fontWeight: 600, fontSize: '1rem' }}>Học phần Lập trình Front-end | Học kỳ 1 năm học 2025 - 2026</h3><h1 style={{ margin: '5px 0', color: '#7f8c8d', fontWeight: 600, fontSize: '1rem' }}>Project cuối kỳ | Nhóm 53</h1>
                        <h3 style={{ margin: '5px 0', color: '#7f8c8d', fontWeight: 600, fontSize: '1rem' }}>Lê Phi Vũ - 20130468</h3>
                        <h3 style={{ margin: '5px 0', color: '#7f8c8d', fontWeight: 600, fontSize: '1rem' }}>Phạm Thanh Sang - 20130385</h3></div>}
                </div>
            </div>
        </div>
    );
};

function MainApp() {
    const { isConnected, sendMessage, latestData } = useWebSocket();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [fullname, setFullname] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const isRegisteringRef = useRef(false);

    const [errorMessage, setErrorMessage] = useState("");
    const [dialogBtnText, setDialogBtnText] = useState("Nhập thông tin đăng nhập");
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [successDialogMessage, setSuccessDialogMessage] = useState("Loading...");

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState("");
    const [isCheckingSession, setIsCheckingSession] = useState(() => !!localStorage.getItem('re_login_code'));
    const [myChatList, setMyChatList] = useState<User[]>([]);
    const [currentChatTarget, setCurrentChatTarget] = useState<User | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isTargetOnline, setIsTargetOnline] = useState<boolean | null>(null);
    const [searchUserQuery, setSearchUserQuery] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
    const [userFullName, setUserFullName] = useState("");

    const [isInCall, setIsInCall] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);

    const usernameRef = useRef("");
    const passwordRef = useRef("");
    const searchingUserRef = useRef("");
    const currentChatTargetRef = useRef<User | null>(null);
    const myChatListRef = useRef<User[]>([]);
    const lastProcessedDataRef = useRef<any>(null);

    useEffect(() => { usernameRef.current = username; }, [username]);
    useEffect(() => { passwordRef.current = password; }, [password]);
    useEffect(() => { currentChatTargetRef.current = currentChatTarget; }, [currentChatTarget]);
    useEffect(() => { myChatListRef.current = myChatList; }, [myChatList]);

    const startVideoCall = async () => { if (!currentChatTarget) return; setIsInCall(true); try { const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); setLocalStream(stream); const pc = new RTCPeerConnection(rtcConfig); peerConnection.current = pc; stream.getTracks().forEach(track => pc.addTrack(track, stream)); pc.onicecandidate = (event) => { if (event.candidate) sendSignal({ type: 'candidate', candidate: event.candidate }); }; pc.ontrack = (event) => setRemoteStream(event.streams[0]); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sendSignal({ type: 'offer', sdp: offer }); } catch (err) { console.error("Lỗi call:", err); endCall(); } };
    const endCall = () => { if (localStream) localStream.getTracks().forEach(track => track.stop()); if (peerConnection.current) peerConnection.current.close(); setLocalStream(null); setRemoteStream(null); peerConnection.current = null; setIsInCall(false); };
    const sendSignal = (signalData: any) => { if (!currentChatTarget) return; const payload = "::RTC_SIGNAL::" + JSON.stringify(signalData); sendMessage({ event: "SEND_CHAT", data: { type: 'people', to: currentChatTarget.name, mes: payload } }); };
    const handleIncomingSignal = async (signalData: any, sender: string) => { if (!isInCall && signalData.type === 'offer') { if (window.confirm(`Cuộc gọi video từ ${sender}. Nghe máy?`)) { setIsInCall(true); const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); setLocalStream(stream); const pc = new RTCPeerConnection(rtcConfig); peerConnection.current = pc; stream.getTracks().forEach(track => pc.addTrack(track, stream)); pc.onicecandidate = (event) => { if (event.candidate) sendSignal({ type: 'candidate', candidate: event.candidate }); }; pc.ontrack = (event) => setRemoteStream(event.streams[0]); await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); sendSignal({ type: 'answer', sdp: answer }); } } else if (peerConnection.current) { if (signalData.type === 'answer') await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signalData.sdp)); else if (signalData.type === 'candidate') await peerConnection.current.addIceCandidate(new RTCIceCandidate(signalData.candidate)); } };

    useEffect(() => {
        if (isLoggedIn && currentUser) {
            const key = `my_chat_list_${currentUser}`;
            const savedList = localStorage.getItem(key);
            let currentList: User[] = [];

            if (savedList) {
                try { currentList = JSON.parse(savedList); } catch (e) { }
            }

            const isSelfInList = currentList.some(u => u.name === currentUser && u.type === 0);
            if (!isSelfInList) {
                const selfUser: User = { name: currentUser, type: 0 };
                currentList = [selfUser, ...currentList];
                localStorage.setItem(key, JSON.stringify(currentList));
            }

            setMyChatList(currentList);
            sendMessage({ event: "GET_PEOPLE_CHAT_MES", data: { name: currentUser, page: 1 } });
        }
    }, [isLoggedIn, currentUser]);

    const addToMyChatList = (newUser: User) => { setMyChatList(prev => { const exists = prev.some(u => u.name === newUser.name && u.type === newUser.type); let newList; if (exists) { const otherUsers = prev.filter(u => u.name !== newUser.name || u.type !== newUser.type); newList = [newUser, ...otherUsers]; } else { newList = [newUser, ...prev]; } if (usernameRef.current) localStorage.setItem(`my_chat_list_${usernameRef.current}`, JSON.stringify(newList)); return newList; }); };
    const loadChatData = (target: User) => { setChatHistory([]); setIsTargetOnline(null); if (target.type === 1) { sendMessage({ event: "GET_ROOM_CHAT_MES", data: { name: target.name, page: 1 } }); } else { sendMessage({ event: "GET_PEOPLE_CHAT_MES", data: { name: target.name, page: 1 } }); sendMessage({ event: "CHECK_USER_ONLINE", data: { user: target.name } }); } };
    useEffect(() => { if (isCheckingSession) { const timer = setTimeout(() => setIsCheckingSession(false), 2000); return () => clearTimeout(timer); } }, [isCheckingSession]);

    useEffect(() => {
        if (!latestData) return;
        if (latestData === lastProcessedDataRef.current) return;
        lastProcessedDataRef.current = latestData;

        const eventType = latestData.event || latestData.data?.event;
        const payload = latestData.data;

        switch (eventType) {
            case 'REGISTER':
                if (latestData.status === 'success') {
                    if (isRegisteringRef.current) {
                        setSuccessDialogMessage("Đăng ký tài khoản thành công. Đang chuyển hướng vào trang chủ...");
                        sendMessage({ event: "LOGIN", data: { user: usernameRef.current, pass: passwordRef.current } });
                    } else {
                        alert("Đăng ký thành công!"); navigate('/login');
                    }
                }
                else {
                    setShowSuccessDialog(false);
                    let errorMsg = latestData.data?.mes || (latestData as any).mes || "Lỗi không xác định";                    if (errorMsg.includes("Username containt whitespace")) {
                        errorMsg = "Tên đăng nhập không được chứa khoảng trắng";
                    } else if (errorMsg.includes("User already exists")) {
                        errorMsg = "Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác";
                    } else if (errorMsg.includes("Username contain special character")) {
                        errorMsg = "Tên đăng nhập không được chứa ký tự đặc biệt";
                    }

                    setErrorMessage("Đăng ký thất bại: " + errorMsg);
                    setDialogBtnText("Nhập thông tin lại");
                    isRegisteringRef.current = false;
                }
                break;
            case 'LOGIN':
                if (latestData.status === 'success') {
                    setIsLoggedIn(true);
                    setCurrentUser(usernameRef.current);
                    if (payload && payload.RE_LOGIN_CODE) { localStorage.setItem('re_login_code', payload.RE_LOGIN_CODE); localStorage.setItem('username', usernameRef.current); }
                    const state = location.state as { from?: { pathname: string } } | null;

                    if (isRegisteringRef.current) {
                        setTimeout(() => {
                            setShowSuccessDialog(false);
                            navigate(state?.from?.pathname || '/home', { replace: true });
                            isRegisteringRef.current = false;
                            setFullname(""); setConfirmPass("");
                        }, 2000);
                    } else {
                        setSuccessDialogMessage("Đăng nhập thành công. Đang vào trang chủ...");
                        setTimeout(() => {
                            setShowSuccessDialog(false);
                            navigate(state?.from?.pathname || '/home', { replace: true });
                        }, 2000);
                    }
                } else {
                    setShowSuccessDialog(false);
                    setDialogBtnText("Nhập thông tin đăng nhập");
                    setErrorMessage("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
                    if(isRegisteringRef.current) {
                        setShowSuccessDialog(false);
                        isRegisteringRef.current = false;
                    }
                }
                break;
            case 'RE_LOGIN': if (latestData.status === 'success') { setIsLoggedIn(true); setIsCheckingSession(false); if (payload && payload.RE_LOGIN_CODE) { localStorage.setItem('re_login_code', payload.RE_LOGIN_CODE); const savedUser = localStorage.getItem('username'); if(savedUser) { setCurrentUser(savedUser); setUsername(savedUser); usernameRef.current = savedUser; } } if (location.pathname === '/login' || location.pathname === '/register') navigate('/home'); } else { setIsCheckingSession(false); } break;

            case 'GET_PEOPLE_CHAT_MES':
                if (Array.isArray(payload)) {
                    if (currentChatTargetRef.current) setChatHistory(payload.reverse());
                    const myName = usernameRef.current;
                    const nameMsg = payload.find((m: any) => (m.type == 5 || m.type === 'people') && m.name === myName && !m.mes.startsWith("::RTC_SIGNAL::"));
                    if (nameMsg) { setUserFullName(nameMsg.mes); }
                }
                break;
            case 'GET_ROOM_CHAT_MES': if (Array.isArray(payload)) setChatHistory(payload.reverse()); break;

            case 'SEND_CHAT':
                const msg = payload;
                const myName = usernameRef.current;

                if (msg.mes && msg.mes.startsWith("::RTC_SIGNAL::")) { if (msg.name !== myName) { try { handleIncomingSignal(JSON.parse(msg.mes.replace("::RTC_SIGNAL::", "")), msg.name); } catch (e) {} } return; } if (currentChatTargetRef.current) { const target = currentChatTargetRef.current; if (msg.name === myName) return; const isRoomMessage = (msg.type === 1 || msg.type === 'room') && msg.to === target.name; const isFriendMessage = (msg.type === 0 || msg.type === 'people') && msg.name === target.name; if (isRoomMessage || isFriendMessage) { setChatHistory(prev => { if (prev.some(m => m.id && m.id === msg.id)) return prev; if (!msg.createAt) msg.createAt = new Date().toISOString(); return [...prev, msg]; }); } } if (msg.name && msg.name !== currentUser) { playNotificationSound(); if (msg.type === 1 || msg.type === 'room') addToMyChatList({ name: msg.to, type: 1 }); else addToMyChatList({ name: msg.name, type: 0 }); } break;
            case 'CHECK_USER_EXIST':
                if (latestData.status === 'success' && latestData.data && latestData.data.status !== false) {
                    const targetName = searchingUserRef.current;

                    setSuccessDialogMessage(`Kết nối chat với ${targetName} thành công`);

                    setTimeout(() => {
                        const newTarget: User = { name: targetName, type: 0 };
                        addToMyChatList(newTarget);
                        setSearchUserQuery("");
                        setShowSuccessDialog(false);
                        navigate(`/chat/${targetName}`);
                    }, 2000);
                } else {
                    setSuccessDialogMessage("Tài khoản không tồn tại");

                    setTimeout(() => {
                        setShowSuccessDialog(false);
                    }, 2000);
                }
                break;
            case 'CREATE_ROOM': case 'JOIN_ROOM': if (latestData.status === 'success' && latestData.data?.name) { const roomName = latestData.data.name; addToMyChatList({ name: roomName, type: 1 }); navigate(`/chat/${roomName}`); } break;
            case 'CHECK_USER_ONLINE': setIsTargetOnline(latestData.status === 'success'); break;
        }
    }, [latestData, sendMessage, currentUser, navigate, location, isCheckingSession, fullname]);

    const handleRegister = () => {
        setSuccessDialogMessage("Loading...");
        setShowSuccessDialog(true);
        isRegisteringRef.current = true;
        sendMessage({ event: "REGISTER", data: { user: username, pass: password } });
    };

    const handleLogin = () => {
        setSuccessDialogMessage("Loading...");
        setShowSuccessDialog(true);
        sendMessage({ event: "LOGIN", data: { user: username, pass: password } });
    };

    const handleLogout = () => {
        setSuccessDialogMessage("Đang đăng xuất tài khoản");
        setShowSuccessDialog(true);
        sendMessage({ event: "LOGOUT" });
        setTimeout(() => {
            setSuccessDialogMessage("Đăng xuất thành công");
            setTimeout(() => {
                setIsLoggedIn(false);
                localStorage.removeItem('re_login_code');
                setUserFullName("");
                setMyChatList([]);
                setChatHistory([]);
                setCurrentChatTarget(null);
                setCurrentUser("");
                setUsername("");
                setPassword("");
                setShowSuccessDialog(false);
                navigate('/login');
            }, 1000);
        }, 1500);
    };

    const handleCheckUserExist = () => {
        if (!searchUserQuery) return;

        if (searchUserQuery.includes(' ')) {
            setDialogBtnText("Nhập lại");
            setErrorMessage("Tên đăng nhập không được chứa khoảng trắng");
            return;
        }

        const validUsernameRegex = /^[a-zA-Z0-9]+$/;
        if (!validUsernameRegex.test(searchUserQuery)) {
            setDialogBtnText("Nhập lại");
            setErrorMessage("Tên đăng nhập không được chứa ký tự đặc biệt");
            return;
        }

        searchingUserRef.current = searchUserQuery;
        setSuccessDialogMessage("Loading...");
        setShowSuccessDialog(true);
        sendMessage({ event: "CHECK_USER_EXIST", data: { user: searchUserQuery } });
    };

    const handleCreateRoom = () => { const name = prompt("Nhập tên phòng muốn tạo:"); if (name) { sendMessage({ event: "CREATE_ROOM", data: { name: name } }); addToMyChatList({ name: name, type: 1 }); } };
    const handleJoinRoom = () => { const name = prompt("Nhập tên phòng muốn tham gia:"); if(name) { sendMessage({ event: "JOIN_ROOM", data: { name: name } }); addToMyChatList({ name: name, type: 1 }); } };

    const handleSendChat = () => {
        if (!currentChatTarget || !messageInput) return;
        const type = currentChatTarget.type === 1 ? 'room' : 'people';
        sendMessage({ event: "SEND_CHAT", data: { type: type, to: currentChatTarget.name, mes: messageInput } });

        const myMsg: ChatMessage = {
            name: currentUser,
            mes: messageInput,
            to: currentChatTarget.name,
            createAt: new Date().toISOString(),
            type: type as any
        };

        setChatHistory(prev => [...prev, myMsg]);
        setMessageInput("");
        addToMyChatList(currentChatTarget);
    };

    if (isCheckingSession) return <div style={{height: '100vh', display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column'}}><div className="loader" style={{marginBottom: 20}}></div><h3>Đang khôi phục phiên đăng nhập...</h3><small>Vui lòng đợi giây lát</small></div>;

    const chatProps: ChatInterfaceProps = {
        isConnected, currentUser, handleLogout, searchUserQuery, setSearchUserQuery, handleCheckUserExist, handleCreateRoom, handleJoinRoom, myChatList, currentChatTarget, isTargetOnline, chatHistory, messageInput, setMessageInput, handleSendChat, isSidebarOpen, setIsSidebarOpen,
        myChatListRef, currentChatTargetRef, setCurrentChatTarget, loadChatData, addToMyChatList,
        handleVideoCall: startVideoCall, isInCall, localStream, remoteStream, endCall,
        userFullName
    };

    const authProps = {
        username, setUsername,
        password, setPassword,
        fullname, setFullname,
        confirmPass, setConfirmPass,
        handleLogin, handleRegister, isConnected,
        setErrorMessage, setDialogBtnText // Truyền xuống AuthForm
    };

    return (
        <>
            <CustomAlert message={errorMessage} onClose={() => setErrorMessage("")} btnText={dialogBtnText} />

            <SuccessDialog show={showSuccessDialog} message={successDialogMessage} />

            <Routes>
                <Route path="/login" element={isLoggedIn ? <Navigate to={location.state?.from?.pathname || "/home"} replace /> : <AuthForm mode="login" {...authProps} />} />
                <Route path="/register" element={isLoggedIn ? <Navigate to={location.state?.from?.pathname || "/home"} replace /> : <AuthForm mode="register" {...authProps} />} />
                <Route path="/home" element={<RequireAuth isLoggedIn={isLoggedIn}><ChatInterface {...chatProps} /></RequireAuth>} />
                <Route path="/chat/:name" element={<RequireAuth isLoggedIn={isLoggedIn}><ChatInterface {...chatProps} /></RequireAuth>} />
                <Route path="/" element={<Navigate to={isLoggedIn ? "/home" : "/login"} replace />} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <MainApp />
        </BrowserRouter>
    );
}

export default App;