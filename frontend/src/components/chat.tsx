"use client";
import React, { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Image from 'next/image';
import NextAuth, { type Session } from "next-auth";
import { Plane, Send } from 'lucide-react';

interface ChatProps {
  id: number;
  session: Session | null;
}

// Define the type for a chat message
type ChatMessage = {
  id:number | null;
  image: string;
  name: string;
  text: string;
};
  
export default function Chat(props: ChatProps) {
  const { id, session } = props;
  const [socket, setSocket] = useState<Socket | null>(null); // Type the socket
  const [msg, setMsg] = useState('');
  const [is_connection , setIs_connection] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // Use the ChatMessage type
  const [urlName, setUrlName] = useState<string | null | undefined>(null);;
  const [token, setToken] = useState<string | null | undefined>(null);;

  useEffect(() => {
    const socket = io('https://live-platform-api.tokuzou.me', {
      path: '/chat/socket.io/',
    });
    setSocket(socket);
    async function connectChat(){
      const roomId = id;
      if (session?.user) {
        const name = session.user.name;
        setUrlName(name);
        setToken(token);
        socket.emit("join", { roomId: roomId, name: name, image: session.user.image });
        setIs_connection(true);
      } else {
        setUrlName("guest");
        socket.on("connect", () => {
          socket.emit("join", { roomId: roomId, name: "ゲスト", image: "https://live-platform.tokuzou.me/no_image_logo.png" });
          setIs_connection(true);
        });
      }
      socket.on("message", (msg) => {
        setMessages((prevMessages) => [msg, ...prevMessages]);
      });
    }
    connectChat();

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (socket) {
      e.preventDefault();

      if (msg === '') {
        return;
      }

      socket.emit('post', { text: msg});

      setMsg('');
    }
  };

  return (
    <div className="w-[100%] h-[600px] bg-[White] rounded-[10px] border-[1px] mb-[10px]">
      <div className="h-[40px] text-center border-b-[1px]">
        <p className=" pt-2">チャット</p>
      </div>
      <div className="h-[80%] bg-[#ffffff] overflow-y-scroll flex flex-col-reverse">
      {messages.map((message, index) => (
          <div className="m-1 flex items-center chat-message" key={index}>
            <img src={message.image} className='w-[20px] h-[20px] object-cover rounded-full mr-1'></img>
            <span className='mr-[10px] text-[grey] text-[14px] shrink-0 break-keep chat-message-name max-w-[40%] text-ellipsis-1'>{message.name}</span>
            <span className='text-[16px] chat-message-text'> {message.text}</span>
          </div>
      ))}
        {is_connection && (
          <p className="text-[#5f5f5f] m-[10px] chat-status">チャットに接続しました</p>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="flex justify-center w-[100%] items-center">
          <input
            type="text"
            id="msg"
            autoComplete="off"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            className="w-full ml-[10px] my-[10px] block border-solid divide-inherit border-2 rounded-md	h-[30px]"
          />
          <button type="submit" className="w-[40px] h-[40px] p-1 pr-3 ml-2">
            <Send className="m-auto" size={24} />
          </button>
        </div>
      </form>
    </div>
  );
}